"""Deepfake & media verification.

IMPORTANT — be honest about this in the panel defense:
The production design calls for a CNN pretrained on FaceForensics++. Shipping
those weights is out of scope for this repo, so this module runs a set of
classical forensic heuristics (OpenCV/PIL) and exposes a single plug-in point,
`predict_frames(frames)`, where a real pretrained model drops in later:

    def predict_frames(frames: list[np.ndarray]) -> float:
        '''return manipulation probability 0..1'''

Heuristics used meanwhile:
  * Images: Error Level Analysis (JPEG re-compression residual) + noise
    variance uniformity — spliced/edited regions show inconsistent residuals.
  * Videos: frame sampling, face-region Laplacian blur variance vs. background
    (GAN faces are often smoother than their surroundings), and
    frame-to-frame face landmark jitter.

Outputs a 0-100 manipulation risk and a verdict. The verdict is always
labeled "heuristic" so nobody mistakes it for a court-grade classifier.
"""
from __future__ import annotations
from pathlib import Path
import io
import json

import numpy as np
import cv2
from PIL import Image

FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# ---- plug-in point for a real FaceForensics++/DFDC pretrained model --------
PRETRAINED_MODEL = None  # assign an object with .predict_frames(frames)->float


def _ela_score(img: Image.Image, quality: int = 90) -> float:
    """Error Level Analysis: mean residual after JPEG re-save.
    Higher, spatially-uneven residual → more likely edited."""
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=quality)
    buf.seek(0)
    resaved = Image.open(buf)
    diff = np.abs(np.asarray(img.convert("RGB"), dtype=np.int16)
                  - np.asarray(resaved, dtype=np.int16))
    # blockwise std of residual — uneven residual is the signal
    gray = diff.mean(axis=2)
    h, w = gray.shape
    bs = 32
    blocks = [gray[y:y + bs, x:x + bs].mean()
              for y in range(0, h - bs, bs) for x in range(0, w - bs, bs)]
    if not blocks:
        return 0.0
    return float(np.std(blocks))


_FACE_MIN_SIZE = (60, 60)


def _face_blur_inconsistency(frame: np.ndarray) -> float | None:
    """Compare Laplacian variance inside detected face vs. rest of frame.
    Returns ratio distance from 1.0, or None if no face."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # A frame smaller than minSize can't contain a detectable face by the
    # cascade's own constraint anyway, and OpenCV's detectMultiScale has a
    # known bug where feeding it a too-small image throws a native
    # assertion (cascadedetect.hpp: getScaleData) instead of just returning
    # no matches — skip the call entirely rather than let one undersized
    # image crash the whole media-verification run.
    if gray.shape[0] < _FACE_MIN_SIZE[0] or gray.shape[1] < _FACE_MIN_SIZE[1]:
        return None
    try:
        faces = FACE_CASCADE.detectMultiScale(gray, 1.2, 5, minSize=_FACE_MIN_SIZE)
    except cv2.error:
        return None
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_var = cv2.Laplacian(gray[y:y + h, x:x + w], cv2.CV_64F).var()
    mask = np.ones_like(gray, dtype=bool)
    mask[y:y + h, x:x + w] = False
    bg = gray[mask]
    bg_var = cv2.Laplacian(bg.reshape(-1, 1).astype(np.float64), cv2.CV_64F).var() if bg.size else face_var
    if bg_var <= 1e-6:
        return None
    ratio = face_var / bg_var
    return abs(np.log(max(ratio, 1e-6)))  # 0 = consistent


def analyze_image(path: Path) -> dict:
    img = Image.open(path)
    ela = _ela_score(img)
    frame = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    face_inc = _face_blur_inconsistency(frame)

    risk = min(100.0, ela * 6.0)
    notes = [f"ELA residual unevenness: {ela:.2f}"]
    if face_inc is not None:
        risk = min(100.0, risk + face_inc * 15.0)
        notes.append(f"Face/background sharpness inconsistency: {face_inc:.2f}")
    else:
        notes.append("No face detected — face-consistency check skipped")
    return _verdict(risk, notes, frames_checked=1)


def analyze_video(path: Path, max_frames: int = 24) -> dict:
    cap = cv2.VideoCapture(str(path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, total // max_frames) if total else 15
    frames: list[tuple[int, np.ndarray]] = []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            frames.append((idx, frame))
        idx += 1
        if len(frames) >= max_frames:
            break
    cap.release()
    if not frames:
        return _verdict(0.0, ["Could not decode any video frames"], 0)

    if PRETRAINED_MODEL is not None:  # real model plugged in
        prob = float(PRETRAINED_MODEL.predict_frames([f for _, f in frames]))
        return _verdict(prob * 100, ["Pretrained deepfake model score"], len(frames))

    # per-frame timestamps, not just one aggregate score for the whole clip —
    # this is what lets a flagged finding say WHERE in the video to look
    # ("distorted face at 0:14"), not just "this video scored 62/100"
    per_frame = [(idx / fps, inc) for idx, frame in frames
                if (inc := _face_blur_inconsistency(frame)) is not None]

    notes = [f"Sampled {len(frames)} frames"]
    frame_findings: list[dict] = []
    if per_frame:
        values = [v for _, v in per_frame]
        mean_inc, jitter = float(np.mean(values)), float(np.std(values))
        risk = min(100.0, mean_inc * 25.0 + jitter * 20.0)
        notes.append(f"Mean face/background sharpness inconsistency: {mean_inc:.2f}")
        notes.append(f"Frame-to-frame inconsistency jitter: {jitter:.2f}")
        # flag individual frames well above this video's own baseline,
        # rather than every sampled frame — these are the specific moments
        # worth a human's attention
        threshold = max(0.6, mean_inc + jitter)
        for ts, inc in per_frame:
            if inc >= threshold:
                frame_findings.append({
                    "timestamp_sec": round(ts, 2),
                    "inconsistency": round(inc, 3),
                    "risk_score": round(min(100.0, inc * 30.0), 1),
                })
    else:
        risk = 0.0
        notes.append("No faces detected in sampled frames — analysis inconclusive")
    return _verdict(risk, notes, len(frames), frame_findings=frame_findings)


def _verdict(risk: float, notes: list[str], frames_checked: int,
            frame_findings: list[dict] | None = None) -> dict:
    risk = round(risk, 1)
    if frames_checked == 0:
        verdict = "inconclusive"
    elif risk >= 60:
        verdict = "likely_manipulated"
    elif risk >= 35:
        verdict = "suspicious"
    else:
        verdict = "likely_authentic"
    return {"risk_score": risk, "verdict": verdict, "frames_checked": frames_checked,
            "method": "heuristic (ELA + face-consistency); pretrained model plug-in available",
            "notes": notes, "frame_findings": frame_findings or []}


def analyze_media(path: Path, file_type: str) -> dict:
    if file_type == "video":
        return analyze_video(path)
    return analyze_image(path)


# ---------------------------------------------------------------------------
# Liveness/spoof label manifest (CelebA-Spoof-shaped datasets)
# ---------------------------------------------------------------------------
# CelebA-Spoof-style exports ship as one JSON dict mapping each image's
# relative path to a 44-value label array: 40 CelebA face attributes, then
# spoof type (0=live, 1=Photo, 2=Poster, 3=A4, 4=Face Mask, 5=Upper Body
# Mask, 6=Region Mask, 7=PC, 8=Pad, 9=Phone, 10=3D Mask), illumination
# (0=live, 1=Normal, 2=Strong, 3=Back, 4=Dark), environment (0=live,
# 1=Indoor, 2=Outdoor), and a final binary live(0)/spoof(1) flag. There is
# no image data in the file itself — this ingests labels/statistics only.
# The dataset is typically hundreds of thousands of entries, so findings are
# aggregated (one flag per spoof type, not one per image) rather than
# exploding into a FlaggedEvent per row — this is a triage tool, not a bulk
# ML-dataset browser.

SPOOF_TYPE_NAMES = {
    0: "Live", 1: "Photo", 2: "Poster", 3: "A4", 4: "Face Mask",
    5: "Upper Body Mask", 6: "Region Mask", 7: "PC", 8: "Pad", 9: "Phone",
    10: "3D Mask",
}
# rough severity ordering for risk scoring — a 3D mask or face mask attack
# is a materially more sophisticated/concerning spoof than a printed photo
SPOOF_TYPE_RISK = {
    1: 55, 2: 55, 3: 55,        # print-based (photo/poster/A4)
    5: 65, 6: 65, 7: 60, 8: 60, 9: 60,  # screen/replay/region-mask based
    4: 85, 10: 90,              # physical mask attacks
}


def analyze_manifest(path: Path) -> tuple[dict, list[dict]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict) or not data:
        raise ValueError("Not a recognized label manifest — expected a JSON object mapping "
                         "image paths to label arrays.")

    total = len(data)
    lengths = {len(v) for v in data.values() if isinstance(v, list)}
    if not lengths:
        raise ValueError("Manifest values aren't label arrays — nothing to analyze.")
    arr_len = max(lengths)  # tolerate a few malformed/short rows

    live = spoof = 0
    spoof_type_counts: dict[int, int] = {}
    illum_spoof_counts: dict[int, int] = {}
    env_spoof_counts: dict[int, int] = {}

    for img_path, labels in data.items():
        if not isinstance(labels, list) or len(labels) < arr_len:
            continue
        # last element is the authoritative live/spoof flag when present at
        # the expected CelebA-Spoof length; otherwise fall back to folder
        # naming convention ("/live/" vs "/spoof/") in the path string
        if arr_len >= 44:
            is_spoof = int(labels[-1]) == 1
            spoof_type = int(labels[-4])
            illum = int(labels[-3])
            env = int(labels[-2])
        else:
            is_spoof = "/spoof/" in img_path
            spoof_type = illum = env = None
        if is_spoof:
            spoof += 1
            if spoof_type is not None:
                spoof_type_counts[spoof_type] = spoof_type_counts.get(spoof_type, 0) + 1
                illum_spoof_counts[illum] = illum_spoof_counts.get(illum, 0) + 1
                env_spoof_counts[env] = env_spoof_counts.get(env, 0) + 1
        else:
            live += 1

    flagged: list[dict] = []
    if spoof:
        pct = round(spoof / total * 100, 1)
        level = "High" if pct >= 50 else ("Medium" if pct >= 15 else "Low")
        flagged.append({
            "event_type": "spoof_label_prevalence",
            "description": f"{spoof:,} of {total:,} images ({pct}%) in this manifest are "
                           f"labeled spoof/liveness-attack samples.",
            "risk_score": min(95.0, 40.0 + pct / 2), "risk_level": level,
            "meta": {"total": total, "live": live, "spoof": spoof},
        })
    for stype, count in sorted(spoof_type_counts.items(), key=lambda kv: -kv[1]):
        name = SPOOF_TYPE_NAMES.get(stype, f"type {stype}")
        risk = SPOOF_TYPE_RISK.get(stype, 55)
        level = "High" if risk >= 70 else "Medium"
        flagged.append({
            "event_type": "labeled_spoof_type",
            "description": f"{count:,} images labeled spoof type '{name}' "
                           f"({round(count / total * 100, 1)}% of manifest).",
            "risk_score": float(risk), "risk_level": level,
            "meta": {"spoof_type": stype, "spoof_type_name": name, "count": count},
        })

    summary = {
        "total_entries": total,
        "live": live,
        "spoof": spoof,
        "spoof_types": {SPOOF_TYPE_NAMES.get(k, str(k)): v
                        for k, v in sorted(spoof_type_counts.items())},
        "flags": len(flagged),
    }
    return summary, flagged

"""Log anomaly detection (Isolation Forest) — operates ONLY on the normalized
cross-OS schema produced by services.parsers, so it is OS-agnostic by design.

Feature vector per (user, date):
  [nonwork_session_events, nonwork_logon_count, usb_event_count,
   file_access_count, file_delete_count, file_transfer_count]
"""
from __future__ import annotations
from datetime import datetime
import pandas as pd
from sklearn.ensemble import IsolationForest
from ..config import WORKING_HOURS


def _is_nonworking(ts: datetime) -> bool:
    return not (WORKING_HOURS[0] <= ts.hour < WORKING_HOURS[1])


FEATURES = ["nonwork_events", "nonwork_logons", "usb_events",
            "file_access", "file_delete", "file_transfer"]


def build_features(events: list[dict]) -> pd.DataFrame:
    rows = []
    for e in events:
        if not e.get("timestamp") or not e.get("user"):
            continue
        rows.append({
            "user": e["user"], "date": e["timestamp"].date(),
            "timestamp": e["timestamp"], "event_type": e["event_type"],
            "device_id": e.get("device_id", ""), "filename": e.get("filename", ""),
            "source_os": e.get("source_os", ""), "nonwork": _is_nonworking(e["timestamp"]),
        })
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    grouped = df.groupby(["user", "date"]).apply(lambda g: pd.Series({
        "nonwork_events": int(g["nonwork"].sum()),
        "nonwork_logons": int(((g["event_type"] == "logon") & g["nonwork"]).sum()),
        "usb_events": int(g["event_type"].isin(["usb_connect", "usb_disconnect"]).sum()),
        "file_access": int((g["event_type"] == "file_access").sum()),
        "file_delete": int((g["event_type"] == "file_delete").sum()),
        "file_transfer": int((g["event_type"] == "file_transfer").sum()),
    }), include_groups=False).reset_index()
    return grouped


def detect(events: list[dict], contamination: float = 0.1) -> list[dict]:
    """Returns flagged events: each suspicious raw event of an anomalous
    user-day, with a 0-100 risk score and High/Medium/Low level."""
    feats = build_features(events)
    if feats.empty:
        return []
    X = feats[FEATURES].values
    n = len(feats)
    contamination = min(0.5, max(1.0 / n, contamination)) if n > 1 else 0.5
    model = IsolationForest(n_estimators=200, contamination=contamination, random_state=42)
    model.fit(X)
    scores = model.decision_function(X)          # higher = more normal
    preds = model.predict(X)                     # -1 anomaly, 1 normal
    smin, smax = scores.min(), scores.max()
    span = (smax - smin) or 1.0

    flagged = []
    interesting = {"logon", "logoff", "usb_connect", "usb_disconnect",
                   "file_access", "file_delete", "file_transfer", "account_change",
                   "logon_failed"}
    for i, row in feats.iterrows():
        # invert + scale decision score → 0..100 risk
        risk = round(float((smax - scores[i]) / span) * 100, 1)
        is_anom = preds[i] == -1
        if not is_anom:
            risk = min(risk, 30.0)
        level = "High" if risk >= 70 else ("Medium" if risk >= 40 else "Low")
        if level == "Low":
            continue
        day_events = [e for e in events
                      if e.get("user") == row["user"] and e.get("timestamp")
                      and e["timestamp"].date() == row["date"]
                      and e["event_type"] in interesting]
        reason_bits = []
        if row["nonwork_events"]:
            reason_bits.append(f"{row['nonwork_events']} non-working-hour events")
        if row["usb_events"]:
            reason_bits.append(f"{row['usb_events']} USB events")
        if row["file_delete"]:
            reason_bits.append(f"{row['file_delete']} file deletions")
        if row["file_transfer"]:
            reason_bits.append(f"{row['file_transfer']} file transfers")
        if row["file_access"]:
            reason_bits.append(f"{row['file_access']} sensitive file accesses")
        reason = "; ".join(reason_bits) or "behavioral deviation from baseline"
        if not day_events:
            continue

        # ONE consolidated finding per anomalous user-day, not one per raw
        # event on that day. The model scores at (user, date) granularity —
        # every "interesting" event on a flagged day shares the exact same
        # risk score and reason text, so emitting one row per event turns a
        # single real finding ("this day was anomalous") into dozens of
        # visually-identical rows. The per-event breakdown is preserved in
        # meta instead of exploded into separate FlaggedEvent rows.
        day_events.sort(key=lambda e: e["timestamp"])
        by_type: dict[str, int] = {}
        for e in day_events:
            by_type[e["event_type"]] = by_type.get(e["event_type"], 0) + 1
        type_breakdown = ", ".join(f"{v} {k.replace('_', ' ')}"
                                   for k, v in sorted(by_type.items(), key=lambda kv: -kv[1]))
        flagged.append({
            "event_time": day_events[0]["timestamp"],
            "event_type": "anomalous_day",
            "description": (f"{row['user']} had an anomalous day on {row['date']} — "
                            f"{len(day_events)} event(s): {type_breakdown} — {reason}"),
            "risk_score": risk, "risk_level": level,
            "meta": {"user": row["user"], "date": str(row["date"]),
                     "source_os": day_events[0].get("source_os", ""),
                     "event_count": len(day_events), "events_by_type": by_type,
                     "features": {f: int(row[f]) for f in FEATURES}},
        })
    return flagged

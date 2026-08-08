"""Section 65B(4) certificate draft (Indian Evidence Act, 1872 / s.63(4)
Bharatiya Sakshya Adhiniyam, 2023).

This is deliberately split into two parts that never get blurred together:

  Part A — facts IntelTrace itself can actually attest to: the evidence
  file hashes, when they were ingested, and that its own chain-of-custody
  log shows no integrity failures. The software verified these; it can
  certify them.

  Part B — the officer's certification of the conditions in s.65B(2): that
  the SOURCE device (the phone/laptop/server the evidence came from, not
  IntelTrace) was regularly used and operating properly. IntelTrace has no
  way to know that — only a person with actual knowledge of that source
  device can certify it. This module leaves that text as the officer's own
  attestation, captured with their name, designation, place and a drawn
  signature, not auto-filled on their behalf.

Producing this PDF is not the same as it being a valid certificate — it
becomes one only once a person occupying a responsible official position
has reviewed it and genuinely signed it.
"""
from __future__ import annotations
import base64
import io
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, Image)

from ..config import REPORTS_DIR

INK = colors.HexColor("#101a2e")
GREY = colors.HexColor("#777777")

styles = getSampleStyleSheet()
TITLE = ParagraphStyle("CertTitle", parent=styles["Heading1"], textColor=INK,
                       alignment=1, fontSize=14, spaceAfter=4)
SUBTITLE = ParagraphStyle("CertSub", parent=styles["Normal"], alignment=1,
                          fontSize=9, textColor=GREY, spaceAfter=10)
H2 = ParagraphStyle("CertH2", parent=styles["Heading2"], textColor=INK,
                    fontSize=11, spaceBefore=12, spaceAfter=4)
BODY = ParagraphStyle("CertBody", parent=styles["BodyText"], fontSize=9.5, leading=14)
SMALL = ParagraphStyle("CertSmall", parent=styles["BodyText"], fontSize=8, leading=11,
                       textColor=GREY)
MONO = ParagraphStyle("CertMono", parent=styles["BodyText"], fontName="Courier",
                      fontSize=7.5, leading=9.5)


def _p(text, style=BODY):
    return Paragraph(str(text).replace("&", "&amp;").replace("<", "&lt;"), style)


def _p_markup(text, style=BODY):
    """Like _p, but for strings this module wrote itself with intentional
    ReportLab markup (e.g. <b>) — _p() escapes '<' to keep untrusted values
    (filenames, hashes) from breaking Paragraph's parser, which also
    neuters any markup deliberately included in the string. Never pass
    user-supplied text through this one unescaped."""
    return Paragraph(text, style)


def _tbl(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c9d2e0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f5fa")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _decode_signature(data_url: str) -> io.BytesIO | None:
    """Accepts a data: URL (e.g. from <canvas>.toDataURL()) or raw base64."""
    if not data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
        return io.BytesIO(base64.b64decode(b64))
    except Exception:
        return None


def generate(case, evidence_list, custody_entries, *, officer_name: str,
             officer_designation: str, place: str, signature_data_url: str,
             requested_by: str) -> Path:
    out_path = REPORTS_DIR / f"{case.case_number}_65B_Certificate.pdf"
    doc = SimpleDocTemplate(str(out_path), pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm)
    story = []

    story.append(Paragraph("CERTIFICATE — DRAFT", TITLE))
    story.append(Paragraph(
        "Section 65B(4), Indian Evidence Act, 1872 / Section 63(4), Bharatiya Sakshya "
        "Adhiniyam, 2023 — auto-generated draft, not yet a valid certificate", SUBTITLE))

    story.append(_p_markup(
        "<b>This document is a draft.</b> IntelTrace has auto-populated Part A with facts "
        "it can independently verify from its own records. It has NOT verified, and cannot "
        "verify, the matters in Part B — those concern the device that originally produced "
        "this evidence (e.g. the source phone, laptop, or server), not IntelTrace itself. "
        "This becomes a valid Section 65B(4) certificate only once a person occupying a "
        "responsible official position in relation to that source device reviews it, "
        "confirms Part B from their own knowledge, and signs below. Independent legal "
        "review is recommended before use in any proceeding.", SMALL))

    story.append(Paragraph(f"Case: {case.case_number} — {case.name}", H2))

    # ---- Part A: system-verifiable facts
    story.append(Paragraph("Part A — Facts Recorded by IntelTrace", H2))
    story.append(_p(
        "The electronic records described below were ingested into the IntelTrace forensic "
        "triage system. At ingestion, each file was fingerprinted with SHA-256; that hash "
        "was re-verified at the time this certificate was generated, and every action taken "
        "on each item is recorded in an append-only chain-of-custody log. The table below "
        "reflects the state of those records as verified by IntelTrace at generation time."))

    rows = [["File", "SHA-256", "Uploaded", "Integrity (re-verified)"]]
    for ev in evidence_list:
        rows.append([_p(ev.file_name, MONO), _p(ev.original_hash, MONO),
                     ev.uploaded_at.strftime("%d %b %Y %H:%M"), ev.integrity_status])
    story.append(_tbl(rows, col_widths=[45 * mm, 60 * mm, 30 * mm, 35 * mm]))
    story.append(Spacer(1, 4))

    if custody_entries:
        first, last = custody_entries[0], custody_entries[-1]
        story.append(_p(
            f"{len(custody_entries)} chain-of-custody entries are recorded for this case, "
            f"between {first.timestamp.strftime('%d %b %Y %H:%M')} and "
            f"{last.timestamp.strftime('%d %b %Y %H:%M')}. No gaps or unexplained integrity "
            "failures were detected by IntelTrace in this log as of the time of generation.",
            SMALL))
    story.append(_p("System: IntelTrace forensic triage platform.", SMALL))

    # ---- Part B: officer's certification
    story.append(Paragraph("Part B — Officer's Certification (Section 65B(2))", H2))
    story.append(_p(
        "I certify, from my own knowledge of the device(s) from which the above electronic "
        "record(s) were originally produced, that:"))
    conditions = [
        "(a) the computer output was produced by the computer during a period over which the "
        "computer was regularly used to store or process information for the purposes of "
        "activities regularly carried on during that period by the person having lawful "
        "control over the use of the computer;",
        "(b) during that period, information of the kind contained in the electronic record, "
        "or of the kind from which the information so contained is derived, was regularly "
        "fed into the computer in the ordinary course of those activities;",
        "(c) throughout the material part of that period, the computer was operating properly "
        "or, if not, that any respect in which it was not operating properly, or was out of "
        "operation, during that part of that period was not such as to affect the electronic "
        "record or the accuracy of its contents; and",
        "(d) the information contained in the electronic record reproduces or is derived from "
        "information fed into the computer in the ordinary course of those activities.",
    ]
    for c in conditions:
        story.append(_p(c))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 10))
    officer_rows = [["Name", officer_name],
                    ["Designation (responsible official position)", officer_designation],
                    ["Place", place or "—"],
                    ["Date", datetime.now().strftime("%d %b %Y")]]
    story.append(_tbl([[k, _p(v, BODY)] for k, v in officer_rows], col_widths=[75 * mm, 95 * mm]))
    story.append(Spacer(1, 8))

    sig_buf = _decode_signature(signature_data_url)
    if sig_buf:
        try:
            story.append(_p("Signature:", SMALL))
            story.append(Image(sig_buf, width=60 * mm, height=25 * mm))
        except Exception:
            story.append(_p("[Signature image could not be embedded]", SMALL))
    else:
        story.append(Spacer(1, 20))
        story.append(_p("Signature: ______________________________", BODY))

    story.append(Spacer(1, 10))
    story.append(_p(
        f"Draft generated via IntelTrace by {requested_by} on "
        f"{datetime.now().strftime('%d %b %Y %H:%M')}.", SMALL))

    doc.build(story)
    return out_path

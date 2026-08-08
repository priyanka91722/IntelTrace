"""OCR + document text analyzer.
Tesseract extracts text from images; pdfplumber extracts text from PDFs
(including the xlsx→PDF conversion in services/xlsx_convert.py). The same
keyword/pattern rules then flag threat, blackmail, scam and fraud language
(English + common Hinglish phrases) regardless of which source it came from."""
from __future__ import annotations
import re
import shutil
from pathlib import Path

import pdfplumber

from ..config import TESSERACT_CMD

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True

    def _locate_tesseract_cmd() -> str | None:
        """The tesseract binary is often installed but not on PATH (esp. on
        Windows) — pytesseract shells out via PATH by default and can't see
        it. Check an explicit override, then PATH, then common install dirs."""
        if TESSERACT_CMD:
            return TESSERACT_CMD
        on_path = shutil.which("tesseract")
        if on_path:
            return on_path
        for candidate in (r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                          r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"):
            if Path(candidate).exists():
                return candidate
        return None

    _cmd = _locate_tesseract_cmd()
    if _cmd:
        pytesseract.pytesseract.tesseract_cmd = _cmd
except ImportError:  # graceful degradation if pytesseract itself isn't installed
    OCR_AVAILABLE = False

KEYWORD_RULES = [
    # (regex, category, base risk)
    (r"\b(pay or else|or else|last warning|final warning|you will regret)\b", "threat", 85),
    (r"\b(kill|hurt you|destroy you|expose you|leak (your|the) (photos?|videos?))\b", "threat", 90),
    (r"\b(blackmail|ransom|extort(ion)?)\b", "blackmail", 90),
    (r"\b(otp|one time password)\b.{0,40}\b(share|send|batao|bhej)\b", "otp_fraud", 88),
    (r"\b(send|transfer|bhej(o|do)?)\b.{0,30}\b(money|paisa|paise|amount|rs\.?|inr|₹)\b", "money_demand", 70),
    (r"\b(upi|gpay|google ?pay|phonepe|paytm)\b", "payment_channel", 55),
    (r"\b(account (number|no)|ifsc|net ?banking|cvv|card number)\b", "financial_probe", 75),
    (r"\b(lottery|prize|winner|jackpot|claim (your|the) reward)\b", "scam", 72),
    (r"\b(investment|double your money|guaranteed returns?|trading tips?)\b", "investment_scam", 74),
    (r"\b(kyc (update|expired|pending)|account (blocked|suspended|frozen))\b", "phishing", 80),
    (r"\b(delete (the|these) (chats?|messages?)|dont tell (anyone|police)|no police)\b", "concealment", 78),
    (r"\b(warna|dhamki|dhoka|fraud|dhokha)\b", "threat_hinglish", 75),
    (r"\b(bitcoin|btc|usdt|crypto wallet)\b", "crypto_channel", 60),
]

TIME_IN_CHAT = re.compile(r"\b(\d{1,2}:\d{2}\s?(?:am|pm)?)\b", re.I)


def extract_text(image_path: Path) -> str:
    if not OCR_AVAILABLE:
        raise RuntimeError("pytesseract / Tesseract OCR is not installed. "
                           "Install tesseract-ocr and `pip install pytesseract pillow`.")
    img = Image.open(image_path)
    # light preprocessing: grayscale + upscale small screenshots
    img = img.convert("L")
    if img.width < 900:
        img = img.resize((img.width * 2, img.height * 2))
    try:
        return pytesseract.image_to_string(img)
    except pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Tesseract OCR binary could not be found even though pytesseract is "
            "installed. If tesseract.exe is installed but not on PATH, set the "
            "INTELTRACE_TESSERACT_CMD environment variable to its full path."
        ) from exc


# financial_probe ("card number", "account no") and scam ("winner", "prize")
# are written to catch someone SOLICITING that information or running a
# lottery scam in a chat. A genuine receipt/invoice routinely prints its
# OWN transaction's card/account number and a "win a prize" customer-survey
# footer \u2014 completely normal there. Testing against the SROIE receipt
# dataset surfaced exactly this: 3 ordinary retail receipts (a restaurant
# bill, a petrol station receipt, a phone bill) came back "High risk" for
# printing a card number or a promotional prize line. Downgrading (not
# hiding \u2014 still visible, just no longer misrepresented as high risk) these
# two categories when the document is confidently receipt-shaped fixes that
# false-positive pattern without weakening detection on actual chat text.
_RECEIPT_PRONE_CATEGORIES = {"financial_probe", "scam"}


def _is_confident_receipt(receipt_fields: dict | None) -> bool:
    return bool(receipt_fields and receipt_fields.get("vendor") and
               receipt_fields.get("total_amount") is not None)


def analyze_text(text: str, receipt_fields: dict | None = None) -> list[dict]:
    findings = []
    lowered = text.lower()
    receipt_context = _is_confident_receipt(receipt_fields)
    for pattern, category, risk in KEYWORD_RULES:
        for m in re.finditer(pattern, lowered, re.I):
            start = max(0, m.start() - 60)
            snippet = " ".join(text[start:m.end() + 60].split())
            downgraded = receipt_context and category in _RECEIPT_PRONE_CATEGORIES
            effective_risk = min(risk, 20.0) if downgraded else risk
            level = "High" if effective_risk >= 70 else ("Medium" if effective_risk >= 40 else "Low")
            desc = f"Suspicious {category.replace('_', ' ')} language detected: \u201c{snippet}\u201d"
            if downgraded:
                desc += " (downgraded \u2014 routine content on a receipt/invoice, not solicited)"
            findings.append({
                "event_type": f"keyword:{category}",
                "description": desc,
                "risk_score": float(effective_risk), "risk_level": level,
                "meta": {"category": category, "match": m.group(0), "snippet": snippet,
                         "downgraded_receipt_context": downgraded},
            })
    return findings


def analyze_screenshot(image_path: Path) -> tuple[str, list[dict]]:
    text = extract_text(image_path)
    return text, analyze_text(text, receipt_fields=extract_receipt_fields(text))


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Text-native extraction (no OCR) — works for any PDF with embedded
    text, which includes the tables xlsx_convert.py generates."""
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def analyze_pdf(pdf_path: Path) -> tuple[str, list[dict]]:
    text = extract_text_from_pdf(pdf_path)
    return text, analyze_text(text, receipt_fields=extract_receipt_fields(text))


# ---------------------------------------------------------------------------
# Verdict + structured document fields
# ---------------------------------------------------------------------------
# The keyword scan above only ever produces output when it finds something
# wrong — a clean document (the common case) just silently has zero flags,
# which looks identical to "never analyzed" in the evidence list. This gives
# every OCR'd document an explicit verdict either way, plus best-effort
# structured fields for receipt-shaped text (SROIE-style documents etc.) —
# heuristic, not a real NER model, so it degrades gracefully to "not found"
# rather than guessing.

_TOTAL_LINE = re.compile(
    r"(?P<label>grand\s*total|rounded\s*total|net\s*total|total\s*amount|amount\s*due|total|subtotal)"
    r"[^\d\-]{0,20}(?P<amount>-?\d[\d,]*\.\d{2})", re.I)
_CURRENCY = re.compile(r"\b(RM|MYR|INR|Rs\.?|USD|US\$|EUR|GBP|₹|\$|€|£)\b", re.I)
_DOC_NO = re.compile(
    r"(?:document|invoice|receipt|bill|ref(?:erence)?|order)\s*(?:no\.?|number|#)\s*[:\-]?\s*"
    r"([A-Za-z0-9][A-Za-z0-9\-\/]{2,})", re.I)
_DATE = re.compile(
    r"\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|"
    r"[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})\b")
_COMPANY_SUFFIX = re.compile(
    r"\b(SDN\s*BHD|PVT\.?\s*LTD|PRIVATE\s*LIMITED|LLC|LTD\.?|INC\.?|CO\.?\s*LTD|ENTERPRISE)\b", re.I)


def extract_receipt_fields(text: str) -> dict:
    """Best-effort structured fields from receipt/invoice-shaped OCR text.
    Every field is independently optional — only included when actually
    matched, never guessed. This is regex heuristics over noisy OCR output,
    not a trained extraction model; treat it as a starting point for a
    human reviewer, not ground truth."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    fields: dict = {}

    for ln in lines[:10]:
        if _COMPANY_SUFFIX.search(ln):
            fields["vendor"] = ln
            break
    if "vendor" not in fields and lines:
        fields["vendor"] = lines[0]

    doc_no = _DOC_NO.search(text)
    if doc_no:
        fields["document_no"] = doc_no.group(1)

    date_m = _DATE.search(text)
    if date_m:
        fields["date"] = date_m.group(1)

    # prefer the LAST total-shaped line (receipts usually list subtotal
    # before the final/rounded total), and prefer an explicit "grand"/
    # "rounded"/"net" total over a plain "total" if both appear
    best = None
    for m in _TOTAL_LINE.finditer(text):
        label = m.group("label").lower()
        priority = 2 if any(k in label for k in ("grand", "rounded", "net", "due")) else \
                   0 if "subtotal" in label else 1
        if best is None or priority >= best[0]:
            best = (priority, m)
    if best:
        try:
            fields["total_amount"] = float(best[1].group("amount").replace(",", ""))
        except ValueError:
            pass
        cur = _CURRENCY.search(text[max(0, best[1].start() - 10):best[1].end() + 5])
        if cur:
            fields["currency"] = cur.group(1).upper()

    return fields


def verdict_summary(flags: list[dict]) -> dict:
    """Explicit clean/flagged verdict for OCR'd evidence — makes 'analyzed,
    nothing wrong' visually distinct from 'not analyzed yet' in the UI."""
    if not flags:
        return {"verdict": "clean", "risk_level": "None",
                "summary": "No threat, fraud, or blackmail language detected in the extracted text."}
    highest = max(flags, key=lambda f: f["risk_score"])
    return {"verdict": "flagged", "risk_level": highest["risk_level"],
            "summary": f"{len(flags)} suspicious indicator(s) found — "
                      f"highest risk: {highest['risk_level']}."}

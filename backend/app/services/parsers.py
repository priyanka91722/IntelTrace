"""
Cross-OS log ingestion layer.
================================
IntelTrace does NOT try to understand every raw OS log format inside the
analysis modules. Instead every supported source is normalized here into ONE
common event schema before anything else touches it:

    {timestamp, user, event_type, device_id, filename, source_os, raw}

    event_type ∈ {logon, logoff, usb_connect, usb_disconnect,
                  file_access, file_delete, file_transfer,
                  account_change, other}

Supported sources (auto-detected):
  1. Windows Event Log exported as CSV from Event Viewer  (source_os=windows)
     - maps Event IDs: 4624→logon, 4634/4647→logoff, 4663→file_access,
       4660→file_delete, 6416/2003/2100→usb_connect, 2101/2102→usb_disconnect
  2. Windows .evtx binary  (needs `pip install python-evtx`, optional)
  3. Linux syslog / auth.log  (source_os=linux)
     - pam_unix "session opened/closed", useradd/usermod/passwd, sshd events
  4. CERT Insider Threat style CSV (r4.2/r1 merged activity file)
     - columns like: timestamp,event_type,user,pc,action,filename
  5. Generic pre-normalized CSV with the common schema columns

The anomaly-detection module therefore works on standardized fields
regardless of which OS the evidence came from.
"""
from __future__ import annotations
import csv
import io
import re
from datetime import datetime
from pathlib import Path
from typing import Iterable

import pandas as pd

COMMON_FIELDS = ["timestamp", "user", "event_type", "device_id", "filename", "source_os", "raw"]

# ---------------------------------------------------------------- utilities

_TS_FORMATS = [
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S",
    "%m/%d/%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%m/%d/%Y %I:%M:%S %p",
    "%Y/%m/%d %H:%M:%S", "%d-%m-%Y %H:%M", "%m/%d/%Y %H:%M",
]


def parse_ts(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    s = str(value).strip()
    if not s:
        return None
    # ISO 8601 with timezone / microseconds (Linux journald style)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        pass
    s2 = re.sub(r"\.\d+", "", s)
    for fmt in _TS_FORMATS:
        try:
            return datetime.strptime(s2, fmt)
        except ValueError:
            continue
    # classic syslog: "Oct 31 21:05:31" (no year → assume current year)
    m = re.match(r"([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})", s)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {datetime.now().year} {m.group(3)}",
                                     "%b %d %Y %H:%M:%S")
        except ValueError:
            return None
    return None


def _clean_str(val) -> str:
    """Normalize any CSV/Excel cell value to a plain string. pandas
    represents a blank cell as float NaN — and NaN is truthy in Python, so a
    bare `val or ""` guard lets it slip through and `str()` renders it as the
    literal text "nan" instead of empty. Every parser funnels user/device/
    filename fields through here so that only happens once, in one place."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none", "nat", "<na>") else s


def _event(timestamp, user="", event_type="other", device_id="", filename="", source_os="", raw="") -> dict:
    return {"timestamp": timestamp, "user": _clean_str(user),
            "event_type": event_type, "device_id": _clean_str(device_id),
            "filename": _clean_str(filename), "source_os": source_os,
            "raw": _clean_str(raw)[:1000]}


# ------------------------------------------------- 1. Windows Event Viewer CSV

WIN_EVENT_ID_MAP = {
    "4624": "logon", "4625": "logon_failed", "4634": "logoff", "4647": "logoff",
    "4663": "file_access", "4660": "file_delete", "4656": "file_access",
    "6416": "usb_connect", "2003": "usb_connect", "2100": "usb_connect",
    "2101": "usb_disconnect", "2102": "usb_disconnect",
    "4720": "account_change", "4722": "account_change", "4724": "account_change",
}


def parse_windows_csv(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    cols = {c.lower().strip(): c for c in (reader.fieldnames or [])}
    ts_col = next((cols[k] for k in cols if "date" in k or "time" in k), None)
    id_col = next((cols[k] for k in cols if "event id" in k or k == "id" or "eventid" in k), None)
    user_col = next((cols[k] for k in cols if "user" in k or "account" in k), None)
    pc_col = next((cols[k] for k in cols if "computer" in k or "machine" in k or k == "pc"), None)
    events = []
    for row in reader:
        eid = str(row.get(id_col, "")).strip() if id_col else ""
        etype = WIN_EVENT_ID_MAP.get(eid, "other")
        events.append(_event(
            parse_ts(row.get(ts_col)) if ts_col else None,
            user=row.get(user_col, "") if user_col else "",
            event_type=etype,
            device_id=row.get(pc_col, "") if pc_col else "",
            source_os="windows",
            raw=f"EventID={eid} " + ",".join(f"{k}={v}" for k, v in row.items() if v)),
        )
    return events


# ------------------------------------------------- 2. Windows .evtx (optional)

def parse_windows_evtx(path: Path) -> list[dict]:
    try:
        import Evtx.Evtx as evtx  # python-evtx
        import xml.etree.ElementTree as ET
    except ImportError:
        raise RuntimeError("python-evtx is not installed. Run: pip install python-evtx "
                           "— or export the log to CSV from Event Viewer and upload that instead.")
    ns = {"e": "http://schemas.microsoft.com/win/2004/08/events/event"}
    events = []
    with evtx.Evtx(str(path)) as log:
        for record in log.records():
            try:
                root = ET.fromstring(record.xml())
                eid = root.findtext(".//e:EventID", default="", namespaces=ns)
                ts = root.find(".//e:TimeCreated", ns)
                ts_val = parse_ts(ts.get("SystemTime")) if ts is not None else None
                user = ""
                for d in root.findall(".//e:Data", ns):
                    if d.get("Name") in ("TargetUserName", "SubjectUserName") and d.text:
                        user = d.text
                        break
                computer = root.findtext(".//e:Computer", default="", namespaces=ns)
                events.append(_event(ts_val, user=user,
                                     event_type=WIN_EVENT_ID_MAP.get(str(eid), "other"),
                                     device_id=computer, source_os="windows",
                                     raw=f"EventID={eid}"))
            except Exception:
                continue
    return events


# ------------------------------------------------- 3. Linux syslog / auth.log

_LINUX_PATTERNS = [
    (re.compile(r"session opened for user (?P<user>[\w.\-]+)"), "logon"),
    (re.compile(r"session closed for user (?P<user>[\w.\-]+)"), "logoff"),
    (re.compile(r"Accepted \w+ for (?P<user>[\w.\-]+)"), "logon"),          # sshd
    (re.compile(r"Failed password for (?:invalid user )?(?P<user>[\w.\-]+)"), "logon_failed"),
    (re.compile(r"new user: name=(?P<user>[\w.\-]+)"), "account_change"),   # useradd
    (re.compile(r"password changed for (?P<user>[\w.\-]+)"), "account_change"),
    (re.compile(r"add '(?P<user>[\w.\-]+)' to (?:shadow )?group '(?:sudo|adm)'"), "account_change"),
    (re.compile(r"usb \d+-\d+", re.I), "usb_connect"),
]
_LINUX_LINE = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+\-]\d{2}:\d{2})?|[A-Z][a-z]{2}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})"
    r"\s+(?P<host>\S+)\s+(?P<rest>.*)$")


def parse_linux_authlog(text: str) -> list[dict]:
    events = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = _LINUX_LINE.match(line)
        if not m:
            continue
        ts, host, rest = parse_ts(m.group("ts")), m.group("host"), m.group("rest")
        for pattern, etype in _LINUX_PATTERNS:
            pm = pattern.search(rest)
            if pm:
                user = pm.groupdict().get("user", "")
                events.append(_event(ts, user=user, event_type=etype,
                                     device_id=host, source_os="linux", raw=line))
                break
    return events


# ------------------------------------------------- 4. CERT insider-threat CSV
# columns seen in merged CERT r4.2/r1 activity files:
# timestamp,event_type,user,pc,action,id,date,activity,after_hours,filename

_CERT_ACTION_MAP = {
    "logon": "logon", "logoff": "logoff",
    "connect": "usb_connect", "disconnect": "usb_disconnect",
    "file_activity": "file_transfer", "file_transfer": "file_transfer",
    "file_access": "file_access", "file_open": "file_access",
    "file_delete": "file_delete", "file_write": "file_access",
    "http": "other", "email": "other",
}


def parse_cert_csv(df: pd.DataFrame) -> list[dict]:
    cols = {c.lower().strip(): c for c in df.columns}

    def col(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    ts_c = col("timestamp", "date")
    user_c = col("user", "user_id", "employee")
    pc_c = col("pc", "device_id", "machine", "computer")
    act_c = col("action", "activity", "event_type", "event")
    file_c = col("filename", "file", "file_name")
    events = []
    for _, row in df.iterrows():
        action_raw = _clean_str(row.get(act_c, "")).lower() if act_c else ""
        etype = _CERT_ACTION_MAP.get(action_raw, "other")
        # CERT logs mark file_activity with a filename; deletions sometimes
        # appear in the activity column. _event() already strips NaN/"nan"
        # cells to "" for user/device/filename, so no manual cleanup needed here.
        events.append(_event(parse_ts(row.get(ts_c)) if ts_c else None,
                             user=row.get(user_c, "") if user_c else "",
                             event_type=etype,
                             device_id=row.get(pc_c, "") if pc_c else "",
                             filename=row.get(file_c, "") if file_c else "",
                             source_os="windows",
                             raw=",".join(str(v) for v in row.values)))
    return events


# ------------------------------------------------- 5. Wide-format forensic artifact export
# Seen in spreadsheet-based triage exports: ONE ROW per session/case with
# Login_Time/Logoff_Time plus a set of optional artifact columns (USB device
# used, files downloaded/deleted/opened, etc). Each populated artifact column
# on a row becomes its own normalized event at that row's login time — this
# is the wide-table equivalent of a long-format event log.

_WIDE_ARTIFACT_COLUMNS = {
    "usb_device": "usb_connect",
    "download_file": "file_transfer",
    "deleted_file": "file_delete",
    "recyclebin_file": "file_delete",
    "recent_document": "file_access",
    "document_file": "file_access",
    "document": "file_access",
}


def is_wide_forensic_artifact(df: pd.DataFrame) -> bool:
    lower_cols = {c.lower().strip() for c in df.columns}
    return "login_time" in lower_cols and "logoff_time" in lower_cols


def parse_forensic_artifact_wide(df: pd.DataFrame) -> list[dict]:
    cols = {c.lower().strip(): c for c in df.columns}

    def col(*names):
        for n in names:
            if n in cols:
                return cols[n]
        return None

    login_c = col("login_time")
    logoff_c = col("logoff_time")
    # prefer an explicit user/username column; fall back to a case/record
    # identifier so anomaly features can still group per-entity, per-day
    user_c = col("username", "user", "case_id", "record_id")
    device_c = col("user_sid", "device_id", "device_used", "computer", "machine")

    events = []
    for _, row in df.iterrows():
        user = _clean_str(row.get(user_c, "")) if user_c else ""
        device = _clean_str(row.get(device_c, "")) if device_c else ""
        login_ts = parse_ts(row.get(login_c)) if login_c else None
        logoff_ts = parse_ts(row.get(logoff_c)) if logoff_c else None
        raw = ",".join(f"{k}={v}" for k, v in row.items() if pd.notna(v) and str(v).strip())

        if login_ts:
            events.append(_event(login_ts, user=user, event_type="logon",
                                 device_id=device, source_os="windows", raw=raw))
        if logoff_ts:
            events.append(_event(logoff_ts, user=user, event_type="logoff",
                                 device_id=device, source_os="windows", raw=raw))

        anchor_ts = login_ts or logoff_ts
        for artifact_col, etype in _WIDE_ARTIFACT_COLUMNS.items():
            actual = cols.get(artifact_col)
            if not actual:
                continue
            val = row.get(actual)
            if val is None or (isinstance(val, float) and pd.isna(val)) or not str(val).strip():
                continue
            events.append(_event(anchor_ts, user=user, event_type=etype,
                                 device_id=device, filename=str(val).strip(),
                                 source_os="windows", raw=raw))
    return events


# ------------------------------------------------- 6. Generic normalized CSV

def parse_generic_csv(df: pd.DataFrame) -> list[dict]:
    cols = {c.lower().strip(): c for c in df.columns}
    events = []
    for _, row in df.iterrows():
        etype = _clean_str(row.get(cols.get("event_type", ""), "other")).lower() or "other"
        src_os = _clean_str(row.get(cols.get("source_os", ""), "")).lower() if "source_os" in cols else ""
        events.append(_event(parse_ts(row.get(cols.get("timestamp"))),
                             user=row.get(cols.get("user", ""), ""),
                             event_type=etype,
                             device_id=row.get(cols.get("device_id", ""), ""),
                             filename=row.get(cols.get("filename", ""), "") if "filename" in cols else "",
                             source_os=src_os,
                             raw=",".join(str(v) for v in row.values)))
    return events


# ------------------------------------------------- auto-detection entry point

# "generic_csv"/"unknown" are the unconditional last-resort fallbacks below —
# they return one (mostly empty) event per input row even when nothing about
# the file actually matched a recognized log shape. Treating that the same
# as a real detected format (windows_event_csv, forensic_artifact_wide, …)
# is what let non-log CSVs (a transaction graph, a labels file, anything)
# get auto-typed "log" and offered log-anomaly detection on meaningless
# data. Callers should gate on this rather than trusting file_type alone.
LOW_CONFIDENCE_LOG_FORMATS = {"generic_csv", "unknown"}


def detect_and_parse_log(path: Path) -> tuple[str, list[dict]]:
    """Returns (detected_format, normalized_events)."""
    suffix = path.suffix.lower()
    if suffix == ".evtx":
        return "windows_evtx", parse_windows_evtx(path)

    if suffix in (".xlsx", ".xls"):
        df = pd.read_excel(path)
        lower_cols = [c.lower().strip() for c in df.columns]
        if is_wide_forensic_artifact(df):
            return "forensic_artifact_wide", parse_forensic_artifact_wide(df)
        if {"timestamp", "user", "event_type", "source_os"} <= set(lower_cols):
            return "normalized_csv", parse_generic_csv(df)
        if ("action" in lower_cols or "activity" in lower_cols) and \
           ("pc" in lower_cols or "user" in lower_cols):
            return "cert_csv", parse_cert_csv(df)
        return "generic_csv", parse_generic_csv(df)

    text = path.read_text(errors="replace")

    if suffix in (".log", ".txt") or "pam_unix" in text[:4000] or "systemd-logind" in text[:4000]:
        linux_events = parse_linux_authlog(text)
        if linux_events:
            return "linux_syslog", linux_events

    if suffix == ".csv" or "," in text.splitlines()[0] if text.splitlines() else False:
        try:
            df = pd.read_csv(io.StringIO(text))
        except Exception:
            df = None
        if df is not None:
            lower_cols = [c.lower().strip() for c in df.columns]
            if "event id" in lower_cols or "eventid" in lower_cols or "task category" in lower_cols:
                return "windows_event_csv", parse_windows_csv(text)
            if is_wide_forensic_artifact(df):
                return "forensic_artifact_wide", parse_forensic_artifact_wide(df)
            if {"timestamp", "user", "event_type", "source_os"} <= set(lower_cols):
                return "normalized_csv", parse_generic_csv(df)
            if ("action" in lower_cols or "activity" in lower_cols) and \
               ("pc" in lower_cols or "user" in lower_cols):
                return "cert_csv", parse_cert_csv(df)
            return "generic_csv", parse_generic_csv(df)

    # last resort: try linux line format anyway
    linux_events = parse_linux_authlog(text)
    if linux_events:
        return "linux_syslog", linux_events
    return "unknown", []


def summarize(events: Iterable[dict]) -> dict:
    events = list(events)
    by_type: dict[str, int] = {}
    users, oses = set(), set()
    for e in events:
        by_type[e["event_type"]] = by_type.get(e["event_type"], 0) + 1
        if e["user"]:
            users.add(e["user"])
        if e["source_os"]:
            oses.add(e["source_os"])
    ts = [e["timestamp"] for e in events if e["timestamp"]]
    return {"total_events": len(events), "events_by_type": by_type,
            "distinct_users": len(users), "source_os": sorted(oses),
            "first_event": min(ts).isoformat() if ts else None,
            "last_event": max(ts).isoformat() if ts else None}

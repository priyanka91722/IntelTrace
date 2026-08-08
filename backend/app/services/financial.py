"""Financial document analyzer.
Reads a transaction CSV, applies rule checks (duplicates, large round-number
transfers, late-night transfers, rapid succession) plus Isolation Forest on
[amount, hour-of-day, gap-to-previous-txn]."""
from __future__ import annotations
import io
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from .parsers import parse_ts, _clean_str


def _find_col(df: pd.DataFrame, *candidates) -> str | None:
    cols = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        for k, orig in cols.items():
            if cand in k:
                return orig
    return None


def analyze(path: Path) -> tuple[dict, list[dict]]:
    df = pd.read_excel(path) if path.suffix.lower() in (".xlsx", ".xls") else pd.read_csv(path)
    ts_col = _find_col(df, "timestamp", "date", "time")
    amt_col = _find_col(df, "amount", "amt", "value", "debit", "credit")
    from_col = _find_col(df, "from", "sender", "payer", "source_account", "account")
    to_col = _find_col(df, "to", "receiver", "payee", "beneficiary", "dest")
    ref_col = _find_col(df, "reference", "txn_id", "transaction_id", "utr", "ref")

    if amt_col is None:
        raise ValueError("Could not find an amount column in the financial CSV.")

    df["_ts"] = df[ts_col].map(parse_ts) if ts_col else None
    df["_amt"] = pd.to_numeric(df[amt_col].astype(str).str.replace(r"[₹,\s]", "", regex=True),
                               errors="coerce")
    df = df.dropna(subset=["_amt"]).reset_index(drop=True)
    if ts_col:
        df = df.sort_values("_ts").reset_index(drop=True)

    flagged: list[dict] = []

    def flag(row, etype, desc, risk):
        level = "High" if risk >= 70 else ("Medium" if risk >= 40 else "Low")
        flagged.append({
            "event_time": row.get("_ts"),
            "event_type": etype,
            "description": desc,
            "risk_score": float(risk), "risk_level": level,
            "meta": {"amount": float(row["_amt"]),
                     "from": _clean_str(row.get(from_col)) if from_col else "",
                     "to": _clean_str(row.get(to_col)) if to_col else "",
                     "reference": _clean_str(row.get(ref_col)) if ref_col else ""},
        })

    # ---- rule 1: duplicate transactions (same amount + parties)
    dup_keys = ["_amt"] + [c for c in (from_col, to_col) if c]
    dups = df[df.duplicated(subset=dup_keys, keep=False)]
    for _, row in dups.iterrows():
        from_val = _clean_str(row.get(from_col)) if from_col else ""
        to_val = _clean_str(row.get(to_col)) if to_col else ""
        flag(row, "duplicate_transaction",
             f"Duplicate transaction of ₹{row['_amt']:,.2f}"
             + (f" from {from_val}" if from_val else "")
             + (f" to {to_val}" if to_val else ""), 65)

    # ---- rule 2: large round-number transfers
    p90 = df["_amt"].quantile(0.90) if len(df) >= 5 else df["_amt"].max()
    for _, row in df.iterrows():
        amt = row["_amt"]
        if amt >= max(p90, 10000) and amt % 10000 == 0:
            flag(row, "round_number_transfer",
                 f"Large round-number transfer of ₹{amt:,.0f}", 72)

    # ---- rule 3: late-night transactions (00:00–05:00)
    if ts_col:
        for _, row in df.iterrows():
            ts = row["_ts"]
            if ts is not None and (ts.hour < 5):
                flag(row, "late_night_transfer",
                     f"Transaction of ₹{row['_amt']:,.2f} at {ts.strftime('%H:%M')} (late night)", 68)

        # ---- rule 4: rapid succession (>=3 txns within 10 minutes)
        times = df["_ts"].dropna().tolist()
        for i in range(len(times) - 2):
            if (times[i + 2] - times[i]).total_seconds() <= 600:
                row = df[df["_ts"] == times[i + 2]].iloc[0]
                flag(row, "rapid_succession",
                     "3+ transactions within 10 minutes ending "
                     f"{times[i+2].strftime('%H:%M')}", 66)
                break

    # ---- Isolation Forest on numeric features
    if len(df) >= 8:
        feats = pd.DataFrame({"amount": df["_amt"]})
        if ts_col:
            feats["hour"] = df["_ts"].map(lambda t: t.hour if t else 12)
            gaps = df["_ts"].diff().dt.total_seconds().fillna(3600)
            feats["gap"] = np.clip(gaps, 0, 86400)
        model = IsolationForest(n_estimators=200, contamination=0.1, random_state=42)
        preds = model.fit_predict(feats.values)
        scores = model.decision_function(feats.values)
        smin, smax = scores.min(), scores.max()
        span = (smax - smin) or 1.0
        for i, p in enumerate(preds):
            if p == -1:
                risk = round(float((smax - scores[i]) / span) * 100, 1)
                if risk >= 40:
                    flag(df.iloc[i], "ml_anomalous_transaction",
                         f"Isolation Forest flagged transaction of ₹{df.iloc[i]['_amt']:,.2f} "
                         "as a statistical outlier", risk)

    summary = {"total_transactions": int(len(df)),
               "total_amount": float(df["_amt"].sum()),
               "flags": len(flagged)}
    return summary, flagged

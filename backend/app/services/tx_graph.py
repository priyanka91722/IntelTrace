"""Multi-file transaction graph analyzer.

Some evidence sets aren't one self-contained file — a case gets a features
table, a labels/classes table, and a relationship/edge-list table uploaded
as three separate CSV evidence items that only mean something joined
together (e.g. the Elliptic Bitcoin dataset shape, but this isn't hardcoded
to it: any case with a features file + a 2-column label file + a 2-column
edge list gets detected and joined the same way). This module identifies
each file's role by structure (not filename) and joins them into one
per-transaction risk view:

  1. any transaction with a ground-truth "illicit"-style label is flagged
     outright,
  2. any other transaction directly connected (via the edge list) to a
     known-illicit one is flagged by association,
  3. Isolation Forest runs over the anonymized feature columns of the
     remaining unlabeled transactions to surface statistical outliers.
"""
from __future__ import annotations
from collections import defaultdict
from pathlib import Path

import pandas as pd
from sklearn.ensemble import IsolationForest

from .parsers import _clean_str

ILLICIT_LABELS = {"1", "illicit", "fraud", "suspicious", "malicious", "bad"}
LICIT_LABELS = {"2", "licit", "legit", "legitimate", "clean", "good"}

# Fitting Isolation Forest on every unlabeled row is unnecessary and slow for
# very large graphs (100k+ rows) — a representative sample trains a model
# that still scores the full set accurately.
MAX_FIT_SAMPLE = 40_000


def _looks_numeric(s: str) -> bool:
    try:
        float(s)
        return True
    except (TypeError, ValueError):
        return False


def classify_transaction_file(path: Path) -> str:
    """Returns 'features' | 'classes' | 'edges' | 'unknown' by sniffing
    structure — handles a headerless features export (first row is data,
    not column names) the same as one with a real header."""
    try:
        df = pd.read_csv(path, nrows=50)
    except Exception:
        return "unknown"
    if df.shape[1] < 2 or len(df) == 0:
        return "unknown"

    header_cells = [str(c) for c in df.columns]
    header_looks_numeric = all(_looks_numeric(c) for c in header_cells)

    if df.shape[1] == 2:
        low = [h.lower() for h in header_cells]
        if any(("class" in h or "label" in h or "illicit" in h or "fraud" in h) for h in low):
            return "classes"
        # ambiguous 2-column file (generic/numeric headers): a labels column
        # has very few distinct values relative to an edge list's node ids
        try:
            second_col_nunique = df.iloc[:, 1].nunique()
        except Exception:
            second_col_nunique = len(df)
        return "classes" if second_col_nunique <= max(5, len(df) // 4) else "edges"

    if df.shape[1] >= 8 and header_looks_numeric:
        return "features"
    return "unknown"


def _normalize_label(v) -> str:
    s = _clean_str(v).lower()
    if s in ILLICIT_LABELS:
        return "illicit"
    if s in LICIT_LABELS:
        return "licit"
    return "unknown"


def analyze(features_path: Path, classes_path: Path, edges_path: Path) -> tuple[dict, list[dict]]:
    # ---- features: headerless numeric matrix, first col = id, rest = features
    feat_df = pd.read_csv(features_path, header=None)
    n_cols = feat_df.shape[1]
    feat_df.columns = ["tx_id"] + [f"f{i}" for i in range(n_cols - 1)]
    feat_df["tx_id"] = feat_df["tx_id"].astype(str)
    feature_cols = [c for c in feat_df.columns if c != "tx_id"]

    # ---- classes: id + label, column names/order not assumed
    classes_df = pd.read_csv(classes_path)
    id_col = classes_df.columns[0]
    label_col = classes_df.columns[-1]
    classes_df = classes_df.rename(columns={id_col: "tx_id", label_col: "raw_label"})
    classes_df["tx_id"] = classes_df["tx_id"].astype(str)
    classes_df["label"] = classes_df["raw_label"].map(_normalize_label)
    label_map = dict(zip(classes_df["tx_id"], classes_df["label"]))

    # ---- edges: undirected adjacency for "connected to a known-bad node"
    edges_df = pd.read_csv(edges_path).iloc[:, :2]
    edges_df.columns = ["src", "dst"]
    edges_df["src"] = edges_df["src"].astype(str)
    edges_df["dst"] = edges_df["dst"].astype(str)
    neighbors: dict[str, set[str]] = defaultdict(set)
    for src, dst in zip(edges_df["src"], edges_df["dst"]):
        neighbors[src].add(dst)
        neighbors[dst].add(src)

    illicit_ids = {tx for tx, lab in label_map.items() if lab == "illicit"}
    flagged: list[dict] = []

    # ---- 1) ground-truth illicit transactions
    for tx in illicit_ids:
        flagged.append({
            "event_type": "known_illicit_transaction",
            "description": f"Transaction {tx} carries a ground-truth illicit label.",
            "risk_score": 95.0, "risk_level": "High",
            "meta": {"tx_id": tx, "reason": "ground_truth_label"},
        })

    # ---- 2) guilt by association: directly linked to a known-illicit node
    for tx, nbrs in neighbors.items():
        if tx in illicit_ids:
            continue
        illicit_neighbors = nbrs & illicit_ids
        if not illicit_neighbors:
            continue
        n = len(illicit_neighbors)
        risk = min(90.0, 55.0 + n * 8)
        level = "High" if risk >= 70 else "Medium"
        flagged.append({
            "event_type": "linked_to_illicit_transaction",
            "description": f"Transaction {tx} is directly connected to {n} known-illicit "
                            f"transaction(s) in the payment graph.",
            "risk_score": risk, "risk_level": level,
            "meta": {"tx_id": tx, "illicit_neighbor_count": n,
                     "illicit_neighbors": sorted(illicit_neighbors)[:10]},
        })

    # ---- 3) statistical outliers among the unlabeled remainder
    # "unknown" = explicitly labeled unknown, OR absent from the classes file entirely
    known_ids = set(label_map.keys())
    explicit_unknown = {tx for tx, lab in label_map.items() if lab == "unknown"}
    unknown_feat = feat_df[feat_df["tx_id"].isin(explicit_unknown) | ~feat_df["tx_id"].isin(known_ids)]

    if len(unknown_feat) >= 20:
        fit_df = (unknown_feat.sample(n=MAX_FIT_SAMPLE, random_state=42)
                  if len(unknown_feat) > MAX_FIT_SAMPLE else unknown_feat)
        model = IsolationForest(n_estimators=150, contamination=0.05, random_state=42, n_jobs=-1)
        model.fit(fit_df[feature_cols].fillna(0).values)
        X_all = unknown_feat[feature_cols].fillna(0).values
        scores = model.decision_function(X_all)
        preds = model.predict(X_all)
        smin, smax = scores.min(), scores.max()
        span = (smax - smin) or 1.0
        tx_ids = unknown_feat["tx_id"].tolist()
        for i, tx in enumerate(tx_ids):
            if preds[i] != -1:
                continue
            risk = round(float((smax - scores[i]) / span) * 100, 1)
            if risk < 40:
                continue
            level = "High" if risk >= 70 else "Medium"
            flagged.append({
                "event_type": "statistical_outlier_transaction",
                "description": f"Transaction {tx} is a statistical outlier among unlabeled "
                                f"transactions (Isolation Forest over {len(feature_cols)} "
                                f"anonymized features).",
                "risk_score": risk, "risk_level": level,
                "meta": {"tx_id": tx},
            })

    summary = {
        "total_transactions": int(len(feat_df)),
        "labeled_illicit": len(illicit_ids),
        "labeled_licit": int(sum(1 for lab in label_map.values() if lab == "licit")),
        "unknown": int(len(unknown_feat)),
        "total_edges": int(len(edges_df)),
        "flags": len(flagged),
    }
    return summary, flagged

"""Spreadsheet-to-PDF conversion for .xlsx/.xls evidence.

Evidence files are immutable after upload (see CLAUDE.md) — this never
touches the original workbook. It renders every sheet as a table into a
NEW derived PDF stored alongside the original, so the spreadsheet can be
accepted into the same PDF-text analysis path as other document evidence
(services/ocr_chat.py::analyze_pdf), instead of a bespoke xlsx parser.
"""
from __future__ import annotations
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

styles = getSampleStyleSheet()
SHEET_TITLE = ParagraphStyle("XlsxSheetTitle", parent=styles["Heading2"], fontSize=12, spaceAfter=6)

# guard rails so a pathological workbook can't produce an unbuildable PDF
MAX_ROWS_PER_SHEET = 2000
MAX_COLS_PER_SHEET = 20


def convert_to_pdf(xlsx_path: Path, out_pdf_path: Path) -> dict:
    """Renders every sheet of xlsx_path as a table in out_pdf_path.
    Returns {"sheets": [{"name", "rows", "columns", "truncated"}], "total_rows": n}."""
    # Read Excel with keep_default_na=False to preserve empty strings, handle NaN column names
    workbook = pd.read_excel(xlsx_path, sheet_name=None, keep_default_na=False, na_values=[""])
    doc = SimpleDocTemplate(str(out_pdf_path), pagesize=landscape(A4),
                            leftMargin=10 * mm, rightMargin=10 * mm,
                            topMargin=12 * mm, bottomMargin=12 * mm)
    story = []
    sheet_stats = []

    for i, (name, df) in enumerate(workbook.items()):
        # Handle NaN column names and fill remaining nulls with empty string
        df.columns = [str(col) if pd.notna(col) else f"Column_{idx}" for idx, col in enumerate(df.columns)]
        df = df.fillna("").astype(str)
        full_cols, full_rows = len(df.columns), len(df)
        truncated = full_rows > MAX_ROWS_PER_SHEET or full_cols > MAX_COLS_PER_SHEET
        df = df.iloc[:MAX_ROWS_PER_SHEET, :MAX_COLS_PER_SHEET]

        if i > 0:
            story.append(PageBreak())
        title = f"Sheet: {name}"
        if truncated:
            title += f" (showing {len(df)} of {full_rows} rows, {len(df.columns)} of {full_cols} columns)"
        story.append(Paragraph(title, SHEET_TITLE))
        story.append(Spacer(1, 4))

        data = [list(df.columns)] + df.values.tolist()
        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#101a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#c9d2e0")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f5fa")]),
        ]))
        story.append(table)
        sheet_stats.append({"name": str(name), "rows": full_rows,
                            "columns": list(df.columns), "truncated": truncated})

    if not story:
        story.append(Paragraph("(empty workbook)", SHEET_TITLE))
    doc.build(story)
    return {"sheets": sheet_stats, "total_rows": sum(s["rows"] for s in sheet_stats)}

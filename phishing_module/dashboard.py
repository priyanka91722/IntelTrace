from flask import Flask
import sqlite3
import json

app = Flask(__name__)

PAGE_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <title>Phishing Detection Dashboard</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 30px; background: #f7f7f9; }
        h1 { color: #222; }
        h2 { color: #333; font-size: 20px; margin-top: 40px; }
        table { border-collapse: collapse; width: 100%; background: white; }
        th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
        th { background: #333; color: white; text-align: left; }
        tr.quarantined { background: #ffe0e0; }
        tr.none { background: white; }
        .badge { padding: 3px 8px; border-radius: 4px; font-size: 12px; color: white; }
        .badge-quarantined { background: #c0392b; }
        .badge-none { background: #7f8c8d; }
        .ai-label { font-weight: bold; }
        .ai-yes { color: #8e44ad; }
        .ai-no { color: #2980b9; }
        .ai-unknown { color: #95a5a6; }
        .auth-fail { color: #c0392b; font-weight: bold; }
        .auth-pass { color: #27ae60; }
        .auth-unknown { color: #7f8c8d; }
        .small-note { color: #666; font-size: 11px; }
        .chart-box { background: white; padding: 20px; border-radius: 8px; max-width: 900px; margin: 0 auto; }
        .chart-section { text-align: center; margin-top: 50px; }
        .recommendation { font-size: 11px; max-width: 280px; }
    </style>
</head>
<body>
    <h1>Phishing Detection Dashboard</h1>
    <p>Total scanned: {{count}}</p>

    <h2>Scanned emails</h2>
    <table>
        <tr>
            <th>Time</th><th>Folder</th><th>Sender</th><th>Subject</th>
            <th>Phishing Prob</th><th>Personalization</th><th>Fields Matched</th>
            <th>URLs (bad)</th><th>Domain Age</th>
            <th>SPF</th><th>DKIM</th><th>DMARC</th>
            <th>AI Likeness<br><span class="small-note">(burstiness / vocab diversity)</span></th>
            <th>Action</th><th>Recommended Action</th>
        </tr>
        {{rows}}
    </table>

    <div class="chart-section">
        <h2>Personalization score over time</h2>
        <div class="chart-box">
            <canvas id="trendChart" height="80"></canvas>
        </div>
    </div>

    <script>
        const trendLabels = {{trend_labels}};
        const trendData = {{trend_data}};
        new Chart(document.getElementById('trendChart'), {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Personalization score',
                    data: trendData,
                    borderColor: '#8e44ad',
                    backgroundColor: 'rgba(142, 68, 173, 0.1)',
                    tension: 0.2,
                    fill: true
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, suggestedMax: 7 } }
            }
        });
    </script>
</body>
</html>
"""

def get_rows():
    conn = sqlite3.connect("phishing_scans.db")
    c = conn.cursor()
    c.execute("""
        SELECT timestamp, folder, sender, subject, phishing_prob,
               personalization_score, fields_matched,
               url_count, bad_url_count, domain_age_days,
               spf_result, dkim_result, dmarc_result,
               burstiness, vocab_diversity, ai_likeness_label, action_taken,
               recommended_action
        FROM scans
        ORDER BY phishing_prob DESC
    """)
    rows = c.fetchall()
    conn.close()
    return rows

def get_trend_data():
    conn = sqlite3.connect("phishing_scans.db")
    c = conn.cursor()
    c.execute("""
        SELECT timestamp, personalization_score
        FROM scans
        ORDER BY timestamp ASC
    """)
    rows = c.fetchall()
    conn.close()
    labels = [r[0] for r in rows]
    data = [r[1] for r in rows]
    return labels, data

def auth_class(result):
    if result == "fail":
        return "auth-fail"
    elif result == "pass":
        return "auth-pass"
    return "auth-unknown"

def ai_label_html(label, burstiness, vocab_diversity):
    if label is None or label == "insufficient_text":
        return '<span class="ai-label ai-unknown">n/a</span>'
    if "ai_generated" in label:
        css = "ai-yes"
        text = "possibly AI"
    else:
        css = "ai-no"
        text = "possibly human"
    return f'<span class="ai-label {css}">{text}</span><br><span class="small-note">{burstiness} / {vocab_diversity}</span>'

@app.route("/")
def home():
    rows = get_rows()
    trend_labels, trend_data = get_trend_data()

    html_rows = ""
    for r in rows:
        (timestamp, folder, sender, subject, prob, score, fields,
         url_count, bad_url_count, domain_age,
         spf, dkim, dmarc, burstiness, vocab_diversity, ai_label, action,
         recommended_action) = r

        css_class = "quarantined" if action == "quarantined" else "none"
        badge_class = "badge-quarantined" if action == "quarantined" else "badge-none"
        url_display = f"{url_count} ({bad_url_count} bad)" if url_count else "0"
        domain_age_display = f"{domain_age}d" if domain_age is not None else "n/a"

        html_rows += f"""
        <tr class="{css_class}">
            <td>{timestamp}</td>
            <td>{folder}</td>
            <td>{sender}</td>
            <td>{subject}</td>
            <td>{prob}</td>
            <td>{score}</td>
            <td>{fields}</td>
            <td>{url_display}</td>
            <td>{domain_age_display}</td>
            <td class="{auth_class(spf)}">{spf}</td>
            <td class="{auth_class(dkim)}">{dkim}</td>
            <td class="{auth_class(dmarc)}">{dmarc}</td>
            <td>{ai_label_html(ai_label, burstiness, vocab_diversity)}</td>
            <td><span class="badge {badge_class}">{action}</span></td>
            <td class="recommendation">{recommended_action or ''}</td>
        </tr>
        """
    page = (PAGE_TEMPLATE
            .replace("{{rows}}", html_rows)
            .replace("{{count}}", str(len(rows)))
            .replace("{{trend_labels}}", json.dumps(trend_labels))
            .replace("{{trend_data}}", json.dumps(trend_data)))
    return page

if __name__ == "__main__":
    app.run(debug=True, port=5000)
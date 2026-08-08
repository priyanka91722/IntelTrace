"""End-to-end smoke test: login → case → upload all evidence types →
run every module → timeline → cross-case link → PDF report.
Run: python3 smoke_test.py   (uses FastAPI TestClient, no server needed)"""
import os
os.environ.setdefault("INTELTRACE_ADMIN_PASSWORD", "Admin@123")  # deterministic login for this test run

from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
client.__enter__()  # trigger startup events (default admin creation)
DATA = Path(__file__).parent / "sample_data"
ok_count = 0


def check(name, cond, extra=""):
    global ok_count
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} {extra}")
    if cond:
        ok_count += 1
    else:
        raise SystemExit(f"Smoke test failed at: {name}")


# 1. login as default admin
r = client.post("/api/auth/login", data={"username": "admin", "password": "Admin@123"})
check("admin login", r.status_code == 200)
H = {"Authorization": f"Bearer {r.json()['access_token']}"}

# viewer role must be blocked from creating cases
client.post("/api/auth/users", headers=H, json={"username": "v1", "password": "x1234567", "role": "viewer"})
rv = client.post("/api/auth/login", data={"username": "v1", "password": "x1234567"})
HV = {"Authorization": f"Bearer {rv.json()['access_token']}"}
r = client.post("/api/cases", headers=HV, json={"name": "should fail"})
check("viewer blocked from creating case (403)", r.status_code == 403)

# 2. create case
r = client.post("/api/cases", headers=H, json={"name": "Bank Fraud — Branch 7",
                                               "description": "Insider data exfiltration + extortion chat"})
check("case created", r.status_code == 200, r.json().get("case_number", ""))
case_id = r.json()["id"]


def upload(fname, ftype, machine="LAPTOP-PDFEK5V5"):
    with open(DATA / fname, "rb") as f:
        r = client.post(f"/api/cases/{case_id}/evidence", headers=H,
                        files={"file": (fname, f)},
                        data={"file_type": ftype, "machine_id": machine})
    check(f"upload {fname}", r.status_code == 200,
          f"→ {r.json().get('integrity_status')} fmt={r.json().get('parsed_summary', {}).get('detected_format')}")
    return r.json()


# 3. upload all three log formats + financial + chat screenshot
ev_win = upload("windows_security_events.csv", "log")
check("windows CSV detected", ev_win["parsed_summary"]["detected_format"] == "windows_event_csv")
check("windows source_os", ev_win["source_os"] == "windows")

ev_lin = upload("linux_auth.log", "log")
check("linux auth.log detected", ev_lin["parsed_summary"]["detected_format"] == "linux_syslog")
check("linux source_os", ev_lin["source_os"] == "linux")

ev_cert = upload("cert_style_activity.csv", "log", machine="HQ-DC01")
check("CERT CSV detected", ev_cert["parsed_summary"]["detected_format"] == "cert_csv")

ev_fin = upload("transactions.csv", "financial_csv")
ev_chat = upload("chat_screenshot.png", "chat_screenshot")

# hash sanity: 64 hex chars, verified
check("sha256 stored", len(ev_win["original_hash"]) == 64 and ev_win["integrity_status"] == "Verified")

# 4. run analyses
r = client.post(f"/api/evidence/{ev_win['id']}/analyze/log-anomaly", headers=H)
check("log anomaly (windows)", r.status_code == 200, f"flagged={r.json()['flagged']}")
r = client.post(f"/api/evidence/{ev_cert['id']}/analyze/log-anomaly", headers=H)
check("log anomaly (CERT)", r.status_code == 200 and r.json()["flagged"] > 0,
      f"flagged={r.json()['flagged']}")
r = client.post(f"/api/evidence/{ev_lin['id']}/analyze/log-anomaly", headers=H)
check("log anomaly (linux)", r.status_code == 200, f"flagged={r.json()['flagged']}")

r = client.post(f"/api/evidence/{ev_fin['id']}/analyze/financial", headers=H)
check("financial analysis", r.status_code == 200 and r.json()["flagged"] > 0,
      f"flagged={r.json()['flagged']}")

r = client.post(f"/api/evidence/{ev_chat['id']}/analyze/ocr-chat", headers=H)
check("OCR chat analysis", r.status_code == 200 and r.json()["flagged"] > 0,
      f"flagged={r.json()['flagged']} chars={r.json()['ocr_chars']}")

r = client.post(f"/api/evidence/{ev_chat['id']}/analyze/media", headers=H)
check("media verification", r.status_code == 200, f"verdict={r.json()['verdict']}")

# 5. cross-case link: second case reusing same UPI id
r = client.post("/api/cases", headers=H, json={"name": "Extortion — Andheri cyber cell"})
case2 = r.json()["id"]
with open(DATA / "chat_screenshot.png", "rb") as f:
    r = client.post(f"/api/cases/{case2}/evidence", headers=H,
                    files={"file": ("chat2.png", f)}, data={"file_type": "chat_screenshot"})
ev2 = r.json()
r = client.post(f"/api/evidence/{ev2['id']}/analyze/ocr-chat", headers=H)
check("cross-case link created", r.json()["new_cross_case_links"] >= 1,
      f"links={r.json()['new_cross_case_links']}")
r = client.get(f"/api/cases/{case_id}/links", headers=H)
check("links visible from case 1", len(r.json()) >= 1)

# 6. timeline
r = client.get(f"/api/cases/{case_id}/timeline", headers=H)
tl = r.json()
check("timeline reconstructed", r.status_code == 200 and len(tl) > 0, f"{len(tl)} events")
times = [t["timestamp"] for t in tl]
check("timeline chronologically sorted", times == sorted(times))
check("related-sequence grouping present", any(t["related_to_previous"] for t in tl))

# 7. flagged events + custody
r = client.get(f"/api/cases/{case_id}/flagged", headers=H)
check("flagged events listed", len(r.json()) > 0, f"{len(r.json())} total")
r = client.get(f"/api/cases/{case_id}/custody", headers=H)
check("chain of custody populated", len(r.json()) >= 8, f"{len(r.json())} entries")

# 8. PDF report
r = client.post(f"/api/cases/{case_id}/report", headers=H)
check("report generated", r.status_code == 200, r.json().get("file"))
r = client.get(r.json()["download_url"], headers=H)
check("report downloads as PDF", r.status_code == 200 and r.content[:4] == b"%PDF",
      f"{len(r.content)} bytes")

print(f"\nAll {ok_count} checks passed. IntelTrace backend pipeline is working end to end.")

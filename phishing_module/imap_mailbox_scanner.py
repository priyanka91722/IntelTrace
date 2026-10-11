import imaplib
import email
from email.header import decode_header
import joblib
import re
import spacy
import pandas as pd
import sqlite3
from datetime import datetime, timezone
import whois
import statistics

# ===== FILL THESE IN BEFORE RUNNING =====
EMAIL_ACCOUNT = "priyankaaaa917@gmail.com"
APP_PASSWORD = "cqeeglfllbrnlkfe"   # the 16-character app password, no spaces

# The identity YOU used in your phishing-style test emails
MY_NAME = "Jaishree"
MY_COMPANY = "LinkedIn"
MY_PHONE = ""     # leave as "" if you didn't include one in your test emails
MY_EMAIL = EMAIL_ACCOUNT

# ===== Threshold + allowlist =====
QUARANTINE_THRESHOLD = 0.55
ALLOWLIST_DOMAINS = ["linkedin.com", "google.com", "accounts.google.com", "em.linkedin.com",
                      "openai.com", "chatgpt.com", "mail.openai.com", "e.openai.com"]
DOMAIN_AGE_THRESHOLD_DAYS = 30

# ===== Load trained model =====
clf = joblib.load("phishing_classifier.pkl")
vectorizer = joblib.load("tfidf_vectorizer.pkl")
nlp = spacy.load("en_core_web_sm")

DESIGNATION_WORDS = ['manager', 'ceo', 'director', 'officer', 'president',
                      'executive', 'hr', 'administrator', 'supervisor', 'md', 'vp',
                      'finance manager', 'access']

def load_phishtank_blocklist():
    try:
        pt = pd.read_csv("phishtank_urls.csv")
        return set(pt['url'].str.strip().str.lower())
    except Exception as e:
        print(f"Warning: could not load phishtank_urls.csv ({e}). Link check will be skipped.")
        return set()

PHISHTANK_URLS = load_phishtank_blocklist()
URL_RE = re.compile(r'https?://[^\s<>"\']+')

def check_urls(text):
    urls = URL_RE.findall(text)
    bad_urls = [u for u in urls if u.strip().lower() in PHISHTANK_URLS]
    return len(urls), bad_urls

def get_domain_age_days(domain):
    try:
        w = whois.whois(domain)
        created = w.creation_date
        if isinstance(created, list):
            created = created[0]
        if created is None:
            return None
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - created).days
    except Exception:
        return None

def personalization_score(text):
    text_lower = text.lower()
    score = 0
    fields = []
    if MY_NAME and MY_NAME.lower() in text_lower:
        score += 1; fields.append("name")
    if MY_COMPANY and MY_COMPANY.lower() in text_lower:
        score += 1; fields.append("company")
    if MY_PHONE and MY_PHONE in text:
        score += 1; fields.append("phone")
    if re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text):
        score += 1; fields.append("email")
    if any(word in text_lower for word in DESIGNATION_WORDS):
        score += 1; fields.append("designation")
    doc = nlp(text[:5000])
    ents = set(ent.label_ for ent in doc.ents)
    if "PERSON" in ents:
        score += 1; fields.append("ner_person")
    if "ORG" in ents:
        score += 1; fields.append("ner_org")
    return score, fields

AI_LIKENESS_VOCAB_THRESHOLD = 0.75     # tuned to 2 manually-written test emails, not scientifically derived
AI_LIKENESS_BURSTINESS_THRESHOLD = 0.5  # below this = more uniform sentence lengths (AI-leaning)
AI_LIKENESS_VOTES_NEEDED = 2            # how many signals must agree before labeling "possibly AI"

FORMAL_AI_PHRASES = [
    "i hope this message finds you", "please do not hesitate", "kindly note",
    "we apologize for any inconvenience", "as a valued", "i would like to inform you",
    "please be advised", "at your earliest convenience", "furthermore", "moreover",
    "in conclusion", "thank you for your understanding", "should you have any questions",
]
CASUAL_HUMAN_MARKERS = [
    "tbh", "idk", "gonna", "kinda", "lol", "hey,", "quick one", "not sure why",
    "let me know", "haha", "yeah",
]
CONTRACTION_RE = re.compile(r"\b\w+'(t|s|re|ve|ll|d|m)\b", re.IGNORECASE)

def ai_likeness_signal(text):
    """
    Experimental, informational only — never used in the quarantine decision.
    Combines 5 weak signals and requires at least AI_LIKENESS_VOTES_NEEDED of
    them to agree before labeling an email "possibly AI generated" — this is
    deliberately harder to trigger than any single metric alone, so a uniform
    but genuinely human email (low vocab diversity for unrelated reasons)
    won't get mislabeled just from one weak signal.
    """
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if s.strip()]
    if len(sentences) < 2:
        return None, None, "insufficient_text"
    lengths = [len(s.split()) for s in sentences]
    mean_len = statistics.mean(lengths)
    if mean_len == 0:
        return None, None, "insufficient_text"
    stdev_len = statistics.stdev(lengths) if len(lengths) > 1 else 0
    burstiness = stdev_len / mean_len

    words = re.findall(r'\b\w+\b', text.lower())
    if len(words) == 0:
        return None, None, "insufficient_text"
    vocab_diversity = len(set(words)) / len(words)

    text_lower = text.lower()
    formal_phrase_hits = sum(1 for p in FORMAL_AI_PHRASES if p in text_lower)
    casual_marker_hits = sum(1 for p in CASUAL_HUMAN_MARKERS if p in text_lower)
    contraction_hits = len(CONTRACTION_RE.findall(text))
    em_dash_count = text.count('—')

    # Each signal casts one vote toward "AI" (1) or stays neutral (0).
    ai_votes = 0
    ai_votes += 1 if vocab_diversity < AI_LIKENESS_VOCAB_THRESHOLD else 0
    ai_votes += 1 if burstiness < AI_LIKENESS_BURSTINESS_THRESHOLD else 0
    ai_votes += 1 if formal_phrase_hits > 0 else 0
    ai_votes += 1 if em_dash_count >= 2 else 0
    # Casual markers / contractions are strong human evidence — each cancels one AI vote.
    ai_votes -= 1 if casual_marker_hits > 0 else 0
    ai_votes -= 1 if contraction_hits > 0 else 0
    ai_votes = max(ai_votes, 0)

    if ai_votes >= AI_LIKENESS_VOTES_NEEDED:
        label = "possibly_ai_generated (low confidence)"
    else:
        label = "possibly_human_written (low confidence)"
    return round(burstiness, 3), round(vocab_diversity, 3), label

# ===== NEW: real sender authentication check (SPF / DKIM / DMARC) =====
def check_authentication(msg):
    """
    Reads Gmail's own Authentication-Results header, already attached to every
    email, to see whether the sender passed SPF, DKIM and DMARC checks.
    This is the same real technique Gmail itself uses to catch spoofed senders.
    """
    auth_header = msg.get("Authentication-Results", "")
    auth_header_lower = auth_header.lower()

    def extract_result(mechanism):
        match = re.search(rf'{mechanism}=(\w+)', auth_header_lower)
        return match.group(1) if match else "unknown"

    spf_result = extract_result("spf")
    dkim_result = extract_result("dkim")
    dmarc_result = extract_result("dmarc")

    auth_failed = any(r == "fail" for r in [spf_result, dkim_result, dmarc_result])
    return spf_result, dkim_result, dmarc_result, auth_failed

def decode_str(s):
    if s is None:
        return ""
    decoded, enc = decode_header(s)[0]
    if isinstance(decoded, bytes):
        return decoded.decode(enc or "utf-8", errors="ignore")
    return decoded

def get_body(msg):
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == "text/plain":
                try:
                    return part.get_payload(decode=True).decode(errors="ignore")
                except Exception:
                    continue
        return ""
    else:
        try:
            return msg.get_payload(decode=True).decode(errors="ignore")
        except Exception:
            return ""

def get_domain(sender):
    match = re.search(r'@([\w.-]+)', sender)
    if not match:
        return ""
    return match.group(1).lower()

def is_allowlisted(domain):
    return any(domain == d or domain.endswith("." + d) for d in ALLOWLIST_DOMAINS)

def init_db():
    conn = sqlite3.connect("phishing_scans.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            folder TEXT,
            sender TEXT,
            subject TEXT,
            phishing_prob REAL,
            personalization_score INTEGER,
            fields_matched TEXT,
            url_count INTEGER,
            bad_url_count INTEGER,
            domain_age_days INTEGER,
            spf_result TEXT,
            dkim_result TEXT,
            dmarc_result TEXT,
            burstiness REAL,
            vocab_diversity REAL,
            ai_likeness_label TEXT,
            action_taken TEXT,
            recommended_action TEXT
        )
    """)
    # Start fresh every run — clears out results from before today's logic
    # changes (and avoids duplicate rows from rescanning the same recent
    # emails). Each run now shows only that run's current, correct results.
    c.execute("DELETE FROM scans")
    conn.commit()
    return conn

def log_to_db(conn, row):
    c = conn.cursor()
    c.execute("""
        INSERT INTO scans (timestamp, folder, sender, subject, phishing_prob,
                            personalization_score, fields_matched,
                            url_count, bad_url_count, domain_age_days,
                            spf_result, dkim_result, dmarc_result,
                            burstiness, vocab_diversity, ai_likeness_label, action_taken,
                            recommended_action)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(timespec="seconds"),
        row["folder"], row["sender"], row["subject"],
        row["phishing_prob"], row["personalization_score"],
        row["fields_matched"], row["url_count"], row["bad_url_count"],
        row["domain_age_days"], row["spf_result"], row["dkim_result"], row["dmarc_result"],
        row["burstiness"], row["vocab_diversity"], row["ai_likeness_label"], row["action_taken"],
        row["recommended_action"]
    ))
    conn.commit()

def build_recommended_action(action, phishing_prob, bad_url_count, risky_domain_age,
                              auth_failed, personalization_score, fields, domain, sender):
    """
    Builds a plain-text recommended action — the 'response ticket' the original
    guide asked for, instead of just logging 'quarantined' or 'none'.

    Important: we recommend action against the specific SENDER ADDRESS, never
    the whole domain. A domain like a college or company's own domain is
    shared by thousands of legitimate people — blocking it outright would
    lock out everyone, not just the attacker. Domain-wide action is only
    suggested when the domain itself looks disposable (very recently
    registered), since that's actual evidence the domain has no legitimate
    use, rather than guessing from the quarantine alone.
    """
    if action != "quarantined":
        return "No action needed — did not meet quarantine criteria."

    reasons = []
    if phishing_prob >= QUARANTINE_THRESHOLD:
        reasons.append(f"high phishing probability ({phishing_prob:.2f})")
    if bad_url_count > 0:
        reasons.append(f"{bad_url_count} known-malicious link(s)")
    if risky_domain_age:
        reasons.append("sender domain registered very recently")
    if auth_failed:
        reasons.append("failed sender authentication (SPF/DKIM/DMARC)")

    reason_text = ", ".join(reasons) if reasons else "multiple risk signals"

    if risky_domain_age:
        # The domain itself is freshly registered — treating the whole domain
        # as disposable/malicious is reasonable evidence-based advice here.
        block_advice = f"block sender address '{sender}' and flag domain '{domain}' for monitoring, since it was registered very recently"
    else:
        # Domain could be a shared provider (gmail.com, an institution's
        # domain, etc.) — only the specific address is implicated.
        block_advice = f"block/report sender address '{sender}' only — do not block the domain '{domain}' itself, as it may be shared by other legitimate users"

    personalization_note = ""
    if personalization_score >= 3:
        personalization_note = f" Email exploited {personalization_score} identity field(s) ({fields}) — treat as a targeted attempt, not generic spam."

    return (f"Quarantined due to: {reason_text}. "
            f"Recommend: {block_advice}, do not click any links, "
            f"and reset credentials if this email was previously interacted with."
            f"{personalization_note}")

def ensure_quarantine_folder(imap):
    try:
        imap.create('"Quarantine"')
    except Exception:
        pass

def quarantine_message(imap, eid):
    imap.copy(eid, '"Quarantine"')
    imap.store(eid, '+FLAGS', '\\Deleted')

def scan_folder(imap, folder_name, label, results, conn, limit=10):
    status, _ = imap.select(folder_name)
    if status != "OK":
        print(f"Could not open folder: {folder_name}")
        return
    status, messages = imap.search(None, "ALL")
    if status != "OK":
        return
    ids = messages[0].split()
    ids = ids[-limit:]
    quarantined_any = False

    for eid in reversed(ids):
        status, msg_data = imap.fetch(eid, "(RFC822)")
        if status != "OK":
            continue
        msg = email.message_from_bytes(msg_data[0][1])

        sender = decode_str(msg.get("From"))
        subject = decode_str(msg.get("Subject"))
        body = get_body(msg)
        full_text = f"{subject} {body}"

        vec = vectorizer.transform([full_text])
        phishing_prob = clf.predict_proba(vec)[0][1]
        score, fields = personalization_score(full_text)

        url_count, bad_urls = check_urls(full_text)
        bad_url_count = len(bad_urls)

        domain = get_domain(sender)
        domain_age = get_domain_age_days(domain) if domain and not is_allowlisted(domain) else None
        risky_domain_age = domain_age is not None and domain_age < DOMAIN_AGE_THRESHOLD_DAYS

        spf_result, dkim_result, dmarc_result, auth_failed = check_authentication(msg)

        burstiness, vocab_diversity, ai_label = ai_likeness_signal(full_text)

        action = "none"
        if not is_allowlisted(domain) and (
            phishing_prob >= QUARANTINE_THRESHOLD or bad_url_count > 0
            or risky_domain_age or auth_failed
        ):
            quarantine_message(imap, eid)
            action = "quarantined"
            quarantined_any = True

        recommended_action = build_recommended_action(
            action, phishing_prob, bad_url_count, risky_domain_age,
            auth_failed, score, ", ".join(fields), domain, sender
        )

        row = {
            "folder": label,
            "sender": sender,
            "subject": subject,
            "phishing_prob": round(float(phishing_prob), 3),
            "personalization_score": score,
            "fields_matched": ", ".join(fields),
            "url_count": url_count,
            "bad_url_count": bad_url_count,
            "domain_age_days": domain_age,
            "spf_result": spf_result,
            "dkim_result": dkim_result,
            "dmarc_result": dmarc_result,
            "burstiness": burstiness,
            "vocab_diversity": vocab_diversity,
            "ai_likeness_label": ai_label,
            "action_taken": action,
            "recommended_action": recommended_action
        }
        results.append(row)
        log_to_db(conn, row)

    if quarantined_any:
        imap.expunge()

def main():
    conn = init_db()

    imap = imaplib.IMAP4_SSL("imap.gmail.com")
    imap.login(EMAIL_ACCOUNT, APP_PASSWORD)
    ensure_quarantine_folder(imap)

    results = []
    scan_folder(imap, "INBOX", "Inbox", results, conn)
    scan_folder(imap, '"[Gmail]/Spam"', "Spam", results, conn)

    imap.logout()
    conn.close()

    df = pd.DataFrame(results)
    if df.empty:
        print("No emails found.")
        return

    df = df.sort_values("phishing_prob", ascending=False)
    print(df.to_string(index=False))
    try:
        df.to_csv("live_mailbox_scan_results.csv", index=False)
    except PermissionError:
        print("Could not save CSV (file is open in another program). Close it and re-run if you need it.")
    print("\nSaved to phishing_scans.db")

if __name__ == "__main__":
    main()
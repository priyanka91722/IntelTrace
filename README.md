# CaseGuard AI

Overview: IntelTrace is a web-based investigation dashboard for cybercrime investigators, cyber cells, and forensic teams to upload, analyze, and manage digital evidence (videos, images, chat screenshots, financial documents, system logs) using AI-assisted analysis. It's designed as an accessible alternative to expensive professional forensic tools (like Magnet AXIOM, Cellebrite), targeting smaller cyber cells and teams without certified forensic training.

Core modules/pages to build:

Login / Role-based Access — Admin, Lead Investigator, Viewer roles with different permissions

Dashboard (Home) — Overview of all active cases, quick stats (total cases, pending analysis, high-risk flags), recent activity feed

Case Management — Create new case (case name, description, date opened, assigned investigators), list of all cases with status (Open/Under Review/Closed), click into a case to see all its evidence

Evidence Upload — Drag-and-drop file upload supporting video, image, PDF, chat screenshots, financial documents, log files; on upload, show a generated SHA-256 hash for each file (evidence integrity verification); tag each file with type (Video/Image/Log/Financial/Chat)

Evidence Integrity Dashboard — List of all uploaded evidence with their hash values, upload timestamp, uploader name, and a "Verified/Tampered" status indicator; option to re-verify a file's hash against original

Financial Anomaly Analyzer — Table view of uploaded transaction data (columns: Transaction ID, Timestamp, Amount, Sender, Receiver, Type) with a "Risk Score" column (0-100) and color-coded flags (Low/Medium/High risk) for suspicious transactions (duplicates, round-number transfers, late-night transactions, rapid succession transfers); filterable/sortable table; summary chart showing risk distribution

Anomaly Detection (System Logs) — Table showing parsed log events (User, Timestamp, Event Type — logon/logoff/USB-connect/file-access, Risk Score); highlight after-hours activity and unusual patterns; simple bar/line chart showing activity over time

OCR & Chat Analysis — Upload chat screenshot, display extracted text (OCR output), highlight flagged suspicious keywords (scam/blackmail/phishing/job-fraud related) in the extracted text, show a category tag and confidence score

Deepfake & Media Verification — Upload video/image, show "Authentic" or "Manipulated" verdict with a confidence percentage, simple visual indicator (green check / red warning)

Timeline Reconstruction — Visual chronological timeline combining events from all evidence types in a case (e.g., "2:10 AM - Login", "2:15 AM - USB Connected", "2:20 AM - File Accessed"), built as a vertical timeline UI component

Chain of Custody Log — Audit trail table showing every action taken on evidence (who viewed/analyzed/exported what, and when)

Forensic Report Generator — A summary page compiling case findings (evidence list, risk scores, timeline, hash verification results) with a "Download PDF Report" button, and a separate "Generate Section 65B Certificate" button that shows a pre-filled legal certificate template (system details, hashes, chain of custody, signature block for investigating officer)

Design direction: Professional, serious, clean — dark navy/charcoal and white color scheme with red/amber/green accent colors for risk indicators (this is a forensic/investigation tool, not a playful consumer app). Sidebar navigation with icons for each module. Card-based layouts for dashboards, clean data tables with sorting/filtering for evidence lists. Include realistic dummy/mock data so all pages look populated and functional (sample cases, sample transactions with varying risk scores, sample log events, sample timeline entries).

Tech expectations: This is a frontend-only prototype for a college major project demo — use mock/static data throughout rather than requiring a real backend; focus on making the UI look complete, professional, and functional for a live demo/presentation.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/513c7c56-60ae-4314-9d05-aaf809d9a1e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

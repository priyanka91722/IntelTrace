# CLAUDE.md — IntelTrace

Digital forensic triage platform. FastAPI backend + React (Vite) frontend.
Student final-year project; clarity beats cleverness.

## Commands

```bash
# backend (from backend/)
uvicorn app.main:app --reload      # run API on :8000
python3 seed.py                    # demo users (Demo@123)
python3 smoke_test.py              # 29-check end-to-end test — run after ANY backend change

# frontend (from frontend/)
npm run dev                        # dev server :5173, proxies /api → :8000
npm run build                      # must pass before committing frontend changes
```

## Architecture rules

1. **Never parse raw OS logs inside analysis modules.** All log ingestion goes
   through `backend/app/services/parsers.py`, which normalizes Windows Event CSV,
   .evtx, Linux syslog, and CERT CSV into `ParsedLogEvent`
   `{timestamp, user, event_type, device_id, filename, source_os}`.
   New OS support = new parser function + registration in `detect_and_parse_log()`.
2. Canonical event_type vocabulary: logon, logoff, usb_connect, usb_disconnect,
   file_access, file_delete, file_transfer, auth_failure, user_add. Anomaly
   features depend on these strings — don't invent variants.
3. Every state-changing route must call `custody.log_action(...)`. The chain of
   custody is a product feature, not logging noise.
4. Evidence files are immutable after upload. Never rewrite anything in
   `evidence_store/`; integrity re-verification depends on it.
5. Risk convention everywhere: 0–100 score, High ≥70, Medium ≥40, else Low.
6. Auth: passlib pbkdf2_sha256 (NOT bcrypt — version conflicts), PyJWT.
   Role ranks: viewer < investigator < admin via `require_role`. `config.py`
   loads `.env` (repo root, gitignored, holds a real generated
   `INTELTRACE_SECRET_KEY` — real env vars still take priority) via
   `python-dotenv`. If that key is unset, `config.py` generates a random
   per-process key (invalidating sessions on restart) rather than falling
   back to a fixed string. The
   auto-created default admin gets a random one-time password (printed once
   on first startup) unless `INTELTRACE_ADMIN_PASSWORD` is set. `/api/auth/login`
   locks a username out for 15 min after 5 failed attempts
   (`services/login_guard.py`, in-memory/per-process). `seed.py` is a
   separate, explicitly-run demo script (`Demo@123` users) — unrelated to the
   auto-admin bootstrap and fine to keep using fixed passwords since it's
   opt-in, not automatic.
7. DB: SQLite default, MySQL via `INTELTRACE_DB_URL`. Keep SQLAlchemy models
   portable across both (no SQLite-only column types).
8. Deepfake module is intentionally heuristic and labeled as such in all output.
   The pretrained-model plug-in point is `PRETRAINED_MODEL` in
   `services/deepfake.py`. Do not claim ML deepfake detection in UI copy.

## Frontend conventions

- TypeScript + Vite. Fetch wrapper in `src/api.ts` (typed `Case`/`Evidence`/
  `FlaggedEvent`/`CustodyEntry`/`CrossCaseLink`/`TimelineItem` mirror
  `backend/app/schemas.py` — keep them in sync when schemas change); JWT in
  localStorage under `inteltrace_auth`; 401 → force re-login.
- All evidentiary data (hashes, case numbers, timestamps, usernames, risk
  scores) renders in mono font — that's the design system's spine and is
  non-negotiable across any future redesign.
- Phosphor-green-on-near-black palette (`--color-bg #070c09`,
  `--color-phosphor #3cff7a`, defined in `src/index.css`) is the brand
  identity — non-negotiable, flat/solid colors only, no gradients anywhere.
  Risk-level colors (red=High, amber=Medium, muted=Low) are a separate,
  fixed semantic convention — never repurpose them as decoration, and never
  let a future brand-accent change touch them.
- UI stack: Tailwind v4, shadcn/ui primitives (`src/components/ui/`,
  Radix-based, configured via `components.json`), Framer Motion (`motion`
  package, `import … from "motion/react"`, shared variants in
  `src/lib/motion.ts`) for entrance/transition/hover micro-interactions.
  Respect `useReducedMotion()` for every Motion addition. Only add shadcn
  primitives actually consumed by a page — don't vendor unused ones.
- `.timeline`/`.tl-*` (evidence-chain component), `.hashchip`/`.dot`
  (integrity chip), and `.ts` (timestamp cell) are hand-written CSS in
  `src/styles.css` — no shadcn/Tailwind primitive fits them well. Everything
  else (buttons, badges, cards, tables, tabs, inputs) uses
  `src/components/ui/*` + Tailwind utility classes.

## Gotchas

- FastAPI TestClient needs `client.__enter__()` (or `with` block) to fire the
  startup hook that creates the default admin.
- `smoke_test.py` sets `INTELTRACE_ADMIN_PASSWORD=Admin@123` itself (before
  importing the app) so its login step stays deterministic despite the admin
  bootstrap password normally being randomized — no manual env var needed to
  run it.
- CORS defaults to `http://localhost:5173`/`127.0.0.1:5173` only
  (`INTELTRACE_CORS_ORIGINS` to override) — a non-default frontend origin/port
  needs this set or API calls will be blocked by the browser.
- Tesseract binary must be installed on the OS; pytesseract alone isn't enough.
- python-evtx is optional; .evtx upload without it returns a clear error rather
  than crashing.
- Frontend uses TypeScript 7 (`tsc`), which removed `tsconfig`'s `baseUrl` as
  a standalone option — only `paths` (resolved relative to the tsconfig file
  itself) is needed for the `@/*` alias. Adding `baseUrl` back throws
  `TS5102`.
- `npx shadcn@latest init/add` hangs waiting on stdin in non-interactive
  shells unless `-t vite -b radix -p nova -y` (or equivalent explicit flags)
  are passed — `-d/--defaults` is not a substitute, it forces
  `template=next`. It also refuses to run at all until Tailwind + the `@/*`
  path alias already exist in the project.

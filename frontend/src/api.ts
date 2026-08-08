const BASE = import.meta.env.VITE_API_BASE || "";

export interface AuthState {
  access_token: string;
  role: string;
  username: string;
  full_name: string;
}

export interface Case {
  id: number;
  case_number: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  evidence_count: number;
  flagged_count: number;
  high_risk_count: number;
}

export interface Evidence {
  id: number;
  case_id: number;
  machine_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  original_hash: string;
  current_hash?: string | null;
  integrity_status: string;
  source_os: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parsed_summary?: any;
  uploaded_at: string;
}

export interface FlaggedEvent {
  id: number;
  case_id: number;
  evidence_id?: number | null;
  module: string;
  event_type: string;
  description: string;
  event_time?: string | null;
  risk_score: number;
  risk_level: string;
  confidence: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any;
}

export interface CustodyEntry {
  id: number;
  case_id?: number | null;
  evidence_id?: number | null;
  action: string;
  detail: string;
  username: string;
  timestamp: string;
  modules_involved?: string | null;
  entities_found?: number | null;
  cross_case_links?: number | null;
}

export interface CrossCaseLink {
  id: number;
  entity_type: string;
  entity_value: string;
  case_a: number;
  case_b: number;
  case_a_number?: string | null;
  case_b_number?: string | null;
  created_at: string;
}

export interface TimelineItem {
  id: number;
  timestamp?: string | null;
  module: string;
  event_type: string;
  description: string;
  evidence_id?: number | null;
  risk_score: number;
  risk_level: string;
  related_to_previous: boolean;
}

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  created_at: string;
}

export interface RiskSummaryEvidence {
  evidence_id: number;
  file_name: string;
  file_type: string;
  records_analyzed: number | null;
  flagged: number;
  high: number;
  medium: number;
  low: number;
  top_event_types: { event_type: string; count: number }[];
}

export interface RiskSignal {
  signal: string;
  count: number;
  risk_level: string;
}

export interface RiskKeyword {
  keyword: string;
  category: string;
  count: number;
  risk_level: string;
  downgraded: boolean;
}

export interface RiskDayBucket {
  date: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface RiskSummary {
  total_flagged: number;
  by_risk_level: { High: number; Medium: number; Low: number };
  by_module: Record<string, number>;
  per_evidence: RiskSummaryEvidence[];
  top_signals: RiskSignal[];
  top_keywords: RiskKeyword[];
  timeline_series: RiskDayBucket[];
}

export function getAuth(): AuthState | null {
  try {
    return JSON.parse(localStorage.getItem("inteltrace_auth") || "null");
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState | null) {
  if (auth) localStorage.setItem("inteltrace_auth", JSON.stringify(auth));
  else localStorage.removeItem("inteltrace_auth");
}

async function handle<T = unknown>(res: Response): Promise<T> {
  if (res.status === 401) {
    setAuth(null);
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : (res as unknown as T);
}

function headers(extra: Record<string, string> = {}) {
  const auth = getAuth();
  return auth ? { Authorization: `Bearer ${auth.access_token}`, ...extra } : extra;
}

export const api = {
  async login(username: string, password: string): Promise<AuthState> {
    const body = new URLSearchParams({ username, password });
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return handle<AuthState>(res);
  },
  get: <T = unknown>(path: string) =>
    fetch(`${BASE}${path}`, { headers: headers() }).then((r) => handle<T>(r)),
  post: <T = unknown>(path: string, json?: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers(json ? { "Content-Type": "application/json" } : {}),
      body: json ? JSON.stringify(json) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T = unknown>(path: string) =>
    fetch(`${BASE}${path}`, { method: "PATCH", headers: headers() }).then((r) => handle<T>(r)),
  del: <T = unknown>(path: string) =>
    fetch(`${BASE}${path}`, { method: "DELETE", headers: headers() }).then((r) => handle<T>(r)),
  upload: <T = unknown>(path: string, formData: FormData) =>
    fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: formData }).then((r) =>
      handle<T>(r)
    ),
  async download(path: string, filename: string) {
    const res = await fetch(`${BASE}${path}`, { headers: headers() });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

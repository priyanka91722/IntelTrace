export type Risk = "Low" | "Medium" | "High";
export const riskColor = (r: Risk) =>
  r === "High"
    ? "text-[color:var(--risk-high)] bg-[color:var(--risk-high)]/10 border-[color:var(--risk-high)]/30"
    : r === "Medium"
      ? "text-[color:var(--risk-medium)] bg-[color:var(--risk-medium)]/10 border-[color:var(--risk-medium)]/30"
      : "text-[color:var(--risk-low)] bg-[color:var(--risk-low)]/10 border-[color:var(--risk-low)]/30";

export const riskFromScore = (score: number): Risk =>
  score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";

export interface Case {
  id: string;
  name: string;
  description: string;
  dateOpened: string;
  status: "Open" | "Under Review" | "Closed";
  investigators: string[];
  evidenceCount: number;
  riskLevel: Risk;
}

export const cases: Case[] = [
  {
    id: "CASE-001",
    name: "Fake Job Offer Fraud",
    description: "Phishing emails offering a remote job and asking for a refundable deposit over UPI.",
    dateOpened: "2025-01-14",
    status: "Open",
    investigators: ["R. Nair", "A. Kapoor"],
    evidenceCount: 1,
    riskLevel: "Medium",
  },
  {
    id: "CASE-002",
    name: "Insider Data Leak",
    description: "Suspected copying of client data to a USB drive from an office machine after hours.",
    dateOpened: "2025-02-03",
    status: "Under Review",
    investigators: ["M. Sharma"],
    evidenceCount: 1,
    riskLevel: "High",
  },
];

export interface Evidence {
  id: string;
  caseId: string;
  name: string;
  type: "Video" | "Image" | "Log" | "Financial" | "Chat" | "Document";
  sizeMB: number;
  sha256: string;
  uploadedAt: string;
  uploader: string;
  verified: boolean;
}

const hash = (seed: string) =>
  Array.from({ length: 64 }, (_, i) => {
    const c = seed.charCodeAt(i % seed.length) + i * 7;
    return (c % 16).toString(16);
  }).join("");

export const evidence: Evidence[] = [
  { id: "EV-001", caseId: "CASE-001", name: "offer_letter.pdf", type: "Document", sizeMB: 1.4, sha256: hash("offer_letter"), uploadedAt: "2025-01-15 11:30", uploader: "R. Nair", verified: true },
  { id: "EV-002", caseId: "CASE-002", name: "usb_event_logs.evtx", type: "Log", sizeMB: 12, sha256: hash("usb_event_logs"), uploadedAt: "2025-02-04 08:15", uploader: "M. Sharma", verified: false },
];

export interface Transaction {
  id: string;
  caseId: string;
  timestamp: string;
  amount: number;
  sender: string;
  receiver: string;
  type: "UPI" | "IMPS" | "NEFT" | "Crypto" | "Card";
  riskScore: number;
  flags: string[];
}

export const transactions: Transaction[] = [
  { id: "TXN-001", caseId: "CASE-001", timestamp: "2025-02-05 02:14", amount: 100000, sender: "A. Sharma", receiver: "Unknown-01", type: "IMPS", riskScore: 92, flags: ["Round amount", "Late-night"] },
  { id: "TXN-002", caseId: "CASE-001", timestamp: "2025-02-05 13:45", amount: 1200, sender: "A. Sharma", receiver: "Blinkit", type: "UPI", riskScore: 3, flags: [] },
];

export interface LogEvent {
  id: string;
  caseId: string;
  user: string;
  timestamp: string;
  event: "Logon" | "Logoff" | "USB-Connect" | "File-Access" | "Failed-Logon" | "Admin-Escalation";
  target: string;
  riskScore: number;
}

export const logs: LogEvent[] = [
  { id: "L-001", caseId: "CASE-002", user: "j.doe", timestamp: "2025-02-04 02:12", event: "USB-Connect", target: "Kingston 32GB", riskScore: 88 },
  { id: "L-002", caseId: "CASE-002", user: "m.rao", timestamp: "2025-02-04 09:02", event: "Logon", target: "FIN-WKS-02", riskScore: 5 },
];

export interface TimelineItem {
  caseId: string;
  time: string;
  label: string;
  detail: string;
  type: "auth" | "device" | "file" | "financial" | "media" | "chat";
  risk: Risk;
}

export const timeline: TimelineItem[] = [
  { caseId: "CASE-001", time: "10:20", label: "Email Received", detail: "Job offer mail from hr-globalcorp@mail.com", type: "chat", risk: "Medium" },
  { caseId: "CASE-001", time: "11:05", label: "UPI Payment", detail: "₹4,999 → hr.verify@okaxis", type: "financial", risk: "High" },
  { caseId: "CASE-002", time: "02:10", label: "User Logon", detail: "j.doe → FIN-WKS-04", type: "auth", risk: "High" },
  { caseId: "CASE-002", time: "02:12", label: "USB Connected", detail: "Kingston 32GB (unregistered)", type: "device", risk: "High" },
  { caseId: "CASE-002", time: "02:15", label: "File Accessed", detail: "\\shares\\clients\\PII.xlsx", type: "file", risk: "High" },
  { caseId: "CASE-002", time: "02:16", label: "Bank Transfer", detail: "IMPS ₹1,00,000 → Mule-02", type: "financial", risk: "High" },
  { caseId: "CASE-002", time: "02:22", label: "File Accessed", detail: "\\shares\\clients\\payroll.csv", type: "file", risk: "High" },
  { caseId: "CASE-002", time: "02:31", label: "User Logoff", detail: "j.doe → FIN-WKS-04", type: "auth", risk: "Medium" },
  { caseId: "CASE-002", time: "09:47", label: "Chat Message", detail: "WhatsApp: 'send me the files'", type: "chat", risk: "Medium" },
  { caseId: "CASE-002", time: "11:03", label: "Crypto Transfer", detail: "₹2,50,000 → CryptoEx-Wallet-9F", type: "financial", risk: "High" },
];

export interface CustodyEntry {
  id: string;
  caseId: string;
  when: string;
  actor: string;
  action: string;
  target: string;
}

export const custody: CustodyEntry[] = [
  { id: "C-1", caseId: "CASE-001", when: "2025-01-15 11:30", actor: "R. Nair", action: "Uploaded", target: "EV-001 offer_letter.pdf" },
  { id: "C-2", caseId: "CASE-002", when: "2025-02-04 08:15", actor: "M. Sharma", action: "Uploaded", target: "EV-002 usb_event_logs.evtx" },
];

export interface OcrResult {
  raw: string;
  category: "Job Fraud" | "Sextortion" | "Phishing" | "Investment Scam" | "Benign";
  confidence: number;
  flagged: string[];
}

export const sampleOcr: OcrResult = {
  raw: `Hi, congratulations! You have been shortlisted for a REMOTE position at GlobalCorp. To confirm your onboarding, please pay a refundable security deposit of Rs 4,999 via UPI to hr.verify@okaxis. Failure to pay within 24 hours will cancel your offer. Do not share this OTP with anyone else.`,
  category: "Job Fraud",
  confidence: 0.94,
  flagged: ["refundable security deposit", "pay", "UPI", "OTP", "24 hours", "shortlisted"],
};

export interface DeepfakeResult {
  verdict: "Authentic" | "Manipulated";
  confidence: number;
  cues: string[];
}

export const sampleDeepfake: DeepfakeResult = {
  verdict: "Manipulated",
  confidence: 0.87,
  cues: ["Inconsistent blink rate", "Face-boundary warping", "Audio-lip desync (120ms)", "GAN fingerprint in FFT"],
};

export const stats = {
  totalCases: cases.length,
  openCases: cases.filter((c) => c.status === "Open").length,
  pendingAnalysis: 1,
  highRiskFlags: 2,
  evidenceItems: evidence.length,
};

export const getCase = (id: string) => cases.find((c) => c.id === id);

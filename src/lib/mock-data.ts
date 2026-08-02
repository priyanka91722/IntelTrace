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
    evidenceCount: 3,
    riskLevel: "Medium",
  },
  {
    id: "CASE-002",
    name: "Insider Data Leak",
    description: "Suspected copying of client data to a USB drive from an office machine after hours.",
    dateOpened: "2025-02-03",
    status: "Under Review",
    investigators: ["M. Sharma"],
    evidenceCount: 3,
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
  { id: "EV-002", caseId: "CASE-001", name: "whatsapp_chat.png", type: "Chat", sizeMB: 2.1, sha256: hash("whatsapp_chat"), uploadedAt: "2025-01-15 12:04", uploader: "A. Kapoor", verified: true },
  { id: "EV-003", caseId: "CASE-001", name: "bank_statement.pdf", type: "Financial", sizeMB: 0.8, sha256: hash("bank_statement"), uploadedAt: "2025-01-16 14:11", uploader: "A. Kapoor", verified: true },
  { id: "EV-004", caseId: "CASE-002", name: "usb_event_logs.evtx", type: "Log", sizeMB: 12, sha256: hash("usb_event_logs"), uploadedAt: "2025-02-04 08:15", uploader: "M. Sharma", verified: true },
  { id: "EV-005", caseId: "CASE-002", name: "wallet_txns.csv", type: "Financial", sizeMB: 0.3, sha256: hash("wallet_txns"), uploadedAt: "2025-02-04 16:42", uploader: "M. Sharma", verified: false },
  { id: "EV-006", caseId: "CASE-002", name: "desk_photo.jpg", type: "Image", sizeMB: 3.2, sha256: hash("desk_photo"), uploadedAt: "2025-02-05 09:00", uploader: "P. Desai", verified: true },
];

export interface Transaction {
  id: string;
  timestamp: string;
  amount: number;
  sender: string;
  receiver: string;
  type: "UPI" | "IMPS" | "NEFT" | "Crypto" | "Card";
  riskScore: number;
  flags: string[];
}

export const transactions: Transaction[] = [
  { id: "TXN-90011", timestamp: "2025-02-05 02:14", amount: 100000, sender: "A. Sharma", receiver: "Mule-01", type: "IMPS", riskScore: 92, flags: ["Round amount", "Late-night"] },
  { id: "TXN-90012", timestamp: "2025-02-05 02:16", amount: 100000, sender: "A. Sharma", receiver: "Mule-02", type: "IMPS", riskScore: 95, flags: ["Rapid succession", "Duplicate"] },
  { id: "TXN-90013", timestamp: "2025-02-05 02:18", amount: 100000, sender: "A. Sharma", receiver: "Mule-03", type: "IMPS", riskScore: 96, flags: ["Rapid succession", "Duplicate"] },
  { id: "TXN-90014", timestamp: "2025-02-05 09:20", amount: 4899, sender: "A. Sharma", receiver: "Amazon Pay", type: "UPI", riskScore: 8, flags: [] },
  { id: "TXN-90015", timestamp: "2025-02-05 11:03", amount: 250000, sender: "Mule-01", receiver: "CryptoEx-Wallet-9F", type: "Crypto", riskScore: 88, flags: ["Layering", "High value"] },
  { id: "TXN-90016", timestamp: "2025-02-05 13:45", amount: 1200, sender: "A. Sharma", receiver: "Blinkit", type: "UPI", riskScore: 3, flags: [] },
  { id: "TXN-90017", timestamp: "2025-02-05 23:58", amount: 50000, sender: "Mule-02", receiver: "Mule-04", type: "NEFT", riskScore: 74, flags: ["Late-night", "Layering"] },
  { id: "TXN-90018", timestamp: "2025-02-06 01:05", amount: 50000, sender: "Mule-04", receiver: "CryptoEx-Wallet-9F", type: "Crypto", riskScore: 81, flags: ["Late-night", "Layering"] },
  { id: "TXN-90019", timestamp: "2025-02-06 14:20", amount: 899, sender: "A. Sharma", receiver: "Zomato", type: "UPI", riskScore: 2, flags: [] },
  { id: "TXN-90020", timestamp: "2025-02-06 22:10", amount: 45000, sender: "A. Sharma", receiver: "Mule-05", type: "IMPS", riskScore: 58, flags: ["Unusual receiver"] },
];

export interface LogEvent {
  id: string;
  user: string;
  timestamp: string;
  event: "Logon" | "Logoff" | "USB-Connect" | "File-Access" | "Failed-Logon" | "Admin-Escalation";
  target: string;
  riskScore: number;
}

export const logs: LogEvent[] = [
  { id: "L-501", user: "j.doe", timestamp: "2024-10-27 02:10", event: "Logon", target: "FIN-WKS-04", riskScore: 78 },
  { id: "L-502", user: "j.doe", timestamp: "2024-10-27 02:12", event: "USB-Connect", target: "Kingston 32GB", riskScore: 88 },
  { id: "L-503", user: "j.doe", timestamp: "2024-10-27 02:15", event: "File-Access", target: "\\shares\\clients\\PII.xlsx", riskScore: 92 },
  { id: "L-504", user: "j.doe", timestamp: "2024-10-27 02:22", event: "File-Access", target: "\\shares\\clients\\payroll.csv", riskScore: 89 },
  { id: "L-505", user: "j.doe", timestamp: "2024-10-27 02:31", event: "Logoff", target: "FIN-WKS-04", riskScore: 40 },
  { id: "L-506", user: "m.rao", timestamp: "2024-10-27 09:02", event: "Logon", target: "FIN-WKS-02", riskScore: 5 },
  { id: "L-507", user: "s.iyer", timestamp: "2024-10-27 09:08", event: "Failed-Logon", target: "ADMIN-DC01", riskScore: 65 },
  { id: "L-508", user: "s.iyer", timestamp: "2024-10-27 09:09", event: "Failed-Logon", target: "ADMIN-DC01", riskScore: 72 },
  { id: "L-509", user: "s.iyer", timestamp: "2024-10-27 09:10", event: "Admin-Escalation", target: "ADMIN-DC01", riskScore: 90 },
  { id: "L-510", user: "m.rao", timestamp: "2024-10-27 18:44", event: "Logoff", target: "FIN-WKS-02", riskScore: 3 },
];

export interface TimelineItem {
  time: string;
  label: string;
  detail: string;
  type: "auth" | "device" | "file" | "financial" | "media" | "chat";
  risk: Risk;
}

export const timeline: TimelineItem[] = [
  { time: "02:10", label: "User Logon", detail: "j.doe → FIN-WKS-04", type: "auth", risk: "High" },
  { time: "02:12", label: "USB Connected", detail: "Kingston 32GB (unregistered)", type: "device", risk: "High" },
  { time: "02:15", label: "File Accessed", detail: "\\shares\\clients\\PII.xlsx", type: "file", risk: "High" },
  { time: "02:16", label: "Bank Transfer", detail: "IMPS ₹1,00,000 → Mule-02", type: "financial", risk: "High" },
  { time: "02:22", label: "File Accessed", detail: "\\shares\\clients\\payroll.csv", type: "file", risk: "High" },
  { time: "02:31", label: "User Logoff", detail: "j.doe → FIN-WKS-04", type: "auth", risk: "Medium" },
  { time: "09:47", label: "Chat Message", detail: "WhatsApp: 'send me the files'", type: "chat", risk: "Medium" },
  { time: "11:03", label: "Crypto Transfer", detail: "₹2,50,000 → CryptoEx-Wallet-9F", type: "financial", risk: "High" },
];

export interface CustodyEntry {
  id: string;
  when: string;
  actor: string;
  action: string;
  target: string;
}

export const custody: CustodyEntry[] = [
  { id: "C-1", when: "2025-01-15 11:30", actor: "R. Nair", action: "Uploaded", target: "EV-001 offer_letter.pdf" },
  { id: "C-2", when: "2025-01-15 12:04", actor: "A. Kapoor", action: "Uploaded", target: "EV-002 whatsapp_chat.png" },
  { id: "C-3", when: "2025-01-16 14:11", actor: "A. Kapoor", action: "Uploaded", target: "EV-003 bank_statement.pdf" },
  { id: "C-4", when: "2025-01-16 15:02", actor: "P. Desai", action: "Ran financial check", target: "EV-003" },
  { id: "C-5", when: "2025-02-04 08:15", actor: "M. Sharma", action: "Uploaded", target: "EV-004 usb_event_logs.evtx" },
  { id: "C-6", when: "2025-02-05 09:41", actor: "R. Nair", action: "Viewed", target: "CASE-002 details" },
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
  pendingAnalysis: 2,
  highRiskFlags: 4,
  evidenceItems: evidence.length,
};
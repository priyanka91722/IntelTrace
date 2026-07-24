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
    id: "CASE-2401",
    name: "Operation Nightshade",
    description: "Cross-border UPI fraud ring targeting senior citizens via fake KYC calls.",
    dateOpened: "2024-11-12",
    status: "Open",
    investigators: ["Insp. R. Nair", "SI A. Kapoor"],
    evidenceCount: 24,
    riskLevel: "High",
  },
  {
    id: "CASE-2402",
    name: "Phantom Recruiter",
    description: "Job-fraud phishing operation impersonating a Fortune 500 HR department.",
    dateOpened: "2024-12-03",
    status: "Under Review",
    investigators: ["Insp. M. Sharma"],
    evidenceCount: 17,
    riskLevel: "Medium",
  },
  {
    id: "CASE-2403",
    name: "Deepfake Extortion",
    description: "Sextortion using AI-generated video of victim; suspected foreign server.",
    dateOpened: "2025-01-18",
    status: "Open",
    investigators: ["ACP V. Rao", "SI P. Mehta"],
    evidenceCount: 9,
    riskLevel: "High",
  },
  {
    id: "CASE-2404",
    name: "Insider Data Leak",
    description: "Suspected exfiltration of client PII via USB from finance desk.",
    dateOpened: "2024-10-27",
    status: "Under Review",
    investigators: ["Insp. D. Choudhury"],
    evidenceCount: 12,
    riskLevel: "Medium",
  },
  {
    id: "CASE-2405",
    name: "Crypto Mule Network",
    description: "Layered crypto transfers used to launder proceeds from OTP fraud.",
    dateOpened: "2025-02-05",
    status: "Open",
    investigators: ["SI A. Kapoor", "Insp. R. Nair"],
    evidenceCount: 31,
    riskLevel: "High",
  },
  {
    id: "CASE-2399",
    name: "Ghost Domain",
    description: "Phishing kit hosted on lookalike banking domain.",
    dateOpened: "2024-08-14",
    status: "Closed",
    investigators: ["Insp. M. Sharma"],
    evidenceCount: 6,
    riskLevel: "Low",
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
  { id: "EV-1001", caseId: "CASE-2401", name: "cctv_atm_lobby.mp4", type: "Video", sizeMB: 214, sha256: hash("cctv_atm_lobby"), uploadedAt: "2024-11-13 09:22", uploader: "Insp. R. Nair", verified: true },
  { id: "EV-1002", caseId: "CASE-2401", name: "whatsapp_chat_victim.png", type: "Chat", sizeMB: 2.1, sha256: hash("whatsapp_chat"), uploadedAt: "2024-11-13 10:04", uploader: "SI A. Kapoor", verified: true },
  { id: "EV-1003", caseId: "CASE-2401", name: "bank_statement_nov.pdf", type: "Financial", sizeMB: 0.8, sha256: hash("bank_statement_nov"), uploadedAt: "2024-11-14 14:11", uploader: "SI A. Kapoor", verified: true },
  { id: "EV-1004", caseId: "CASE-2402", name: "offer_letter_scam.pdf", type: "Document", sizeMB: 1.4, sha256: hash("offer_letter"), uploadedAt: "2024-12-04 11:30", uploader: "Insp. M. Sharma", verified: true },
  { id: "EV-1005", caseId: "CASE-2403", name: "extortion_video.mp4", type: "Video", sizeMB: 88, sha256: hash("extortion_video"), uploadedAt: "2025-01-19 02:47", uploader: "ACP V. Rao", verified: false },
  { id: "EV-1006", caseId: "CASE-2404", name: "usb_event_logs.evtx", type: "Log", sizeMB: 12, sha256: hash("usb_event_logs"), uploadedAt: "2024-10-28 08:15", uploader: "Insp. D. Choudhury", verified: true },
  { id: "EV-1007", caseId: "CASE-2405", name: "wallet_txns.csv", type: "Financial", sizeMB: 0.3, sha256: hash("wallet_txns"), uploadedAt: "2025-02-06 16:42", uploader: "SI A. Kapoor", verified: true },
  { id: "EV-1008", caseId: "CASE-2401", name: "suspect_selfie.jpg", type: "Image", sizeMB: 3.2, sha256: hash("suspect_selfie"), uploadedAt: "2024-11-15 09:00", uploader: "Insp. R. Nair", verified: true },
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
  { id: "C-1", when: "2024-11-13 09:22", actor: "Insp. R. Nair", action: "Uploaded", target: "EV-1001 cctv_atm_lobby.mp4" },
  { id: "C-2", when: "2024-11-13 10:04", actor: "SI A. Kapoor", action: "Uploaded", target: "EV-1002 whatsapp_chat_victim.png" },
  { id: "C-3", when: "2024-11-13 10:40", actor: "Analyst K. Bose", action: "Ran OCR", target: "EV-1002" },
  { id: "C-4", when: "2024-11-14 14:11", actor: "SI A. Kapoor", action: "Uploaded", target: "EV-1003 bank_statement_nov.pdf" },
  { id: "C-5", when: "2024-11-14 15:02", actor: "Analyst K. Bose", action: "Ran Financial Anomaly Scan", target: "EV-1003" },
  { id: "C-6", when: "2024-11-15 09:00", actor: "Insp. R. Nair", action: "Uploaded", target: "EV-1008 suspect_selfie.jpg" },
  { id: "C-7", when: "2024-11-15 09:41", actor: "ACP V. Rao", action: "Viewed", target: "CASE-2401 dossier" },
  { id: "C-8", when: "2024-11-16 12:18", actor: "Insp. R. Nair", action: "Exported PDF Report", target: "CASE-2401" },
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
  pendingAnalysis: 7,
  highRiskFlags: 12,
  evidenceItems: evidence.length,
};
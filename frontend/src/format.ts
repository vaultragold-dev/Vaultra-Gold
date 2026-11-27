export function inr(n: number | undefined | null, digits = 2) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function grams(n: number | undefined | null, digits = 4) {
  return `${Number(n || 0).toFixed(digits)}g`;
}

export function floor4(n: number) {
  return Math.floor(n * 10000) / 10000;
}

export function shortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function maskPhone(p?: string) {
  if (!p) return "";
  return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
}

/* ── Basic form rules (same as the panels & server) ─────────────────────── */

/** While typing: 28042002 -> 28/04/2002 (slashes are added automatically). */
export function formatDobInput(text: string) {
  const d = String(text || "").replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** Any saved DOB (28042002, 2002-04-28, 28-04-2002) shown as DD/MM/YYYY. */
export function displayDob(v?: string | null) {
  const s = String(v || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  const d = s.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : s;
}

/** Real calendar date in DD/MM/YYYY, not in the future. */
export function isValidDob(v: string) {
  const m = displayDob(v).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [day, mon, yr] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(yr, mon - 1, day);
  return dt.getFullYear() === yr && dt.getMonth() === mon - 1 && dt.getDate() === day && dt <= new Date() && yr >= 1900;
}

export function isValidEmail(v: string) {
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(String(v || "").trim());
}

/** Indian mobile: digits only, max 10 (safely strips pasted +91 / 0 prefix first). */
export function cleanPhoneInput(text: string) {
  let d = String(text || "").replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  else if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}

export const TXN_LABEL: Record<string, string> = {
  buy: "Gold Purchase",
  buy_silver: "Silver Purchase",
  sell: "Gold Sold",
  sip: "SIP Installment",
  redemption: "Redemption",
  counter_sale: "Counter Purchase",
  reversal: "Reversal",
  gift_sent: "Gift Sent",
  gift_received: "Gift Received",
};

export const TENANT_PHONE: Record<string, string> = {};

export const TENANT_NAME: Record<string, string> = {
  all: "All Stores",
};

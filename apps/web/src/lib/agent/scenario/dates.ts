import { jakartaToday } from "@/lib/jakarta-time";

const DAYS = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, jun: 6, juni: 6,
  jul: 7, juli: 7, agu: 8, agt: 8, agustus: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10,
  nov: 11, november: 11, des: 12, desember: 12,
};

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Parses Indonesian date phrases relative to today in WIB. Returns YYYY-MM-DD or null. */
export function parseDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  const today = jakartaToday(now).date;
  if (/\bhari ini\b/.test(t)) return today;
  if (/\blusa\b/.test(t)) return addDays(today, 2);
  if (/\bbesok\b/.test(t)) return addDays(today, 1);
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dm = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?\b/);
  const named = t.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/);
  const pick = (d: number, m: number, y?: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const year = y ?? (() => {
      const cand = `${today.slice(0, 4)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      return cand < today ? Number(today.slice(0, 4)) + 1 : Number(today.slice(0, 4));
    })();
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  if (named && MONTHS[named[2]!]) return pick(Number(named[1]), MONTHS[named[2]!]!, named[3] ? Number(named[3]) : undefined);
  if (dm) return pick(Number(dm[1]), Number(dm[2]), dm[3] ? Number(dm[3]) : undefined);
  const dayIdx = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
  if (dayIdx >= 0) {
    const cur = new Date(`${today}T00:00:00Z`).getUTCDay();
    let diff = (dayIdx - cur + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }
  return null;
}

/** "14.00", "14:30", "jam 9" → HH:MM */
export function parseTime(text: string): string | null {
  const m = text.toLowerCase().match(/\b(?:jam|pukul)?\s*(\d{1,2})(?:[.:](\d{2}))?\s*(?:wib)?\b/);
  const explicit = text.match(/\b(\d{1,2})[.:](\d{2})\b/) ?? text.toLowerCase().match(/\b(?:jam|pukul)\s+(\d{1,2})\b/);
  if (!explicit || !m) return null;
  const h = Number(explicit[1]);
  const min = Number(explicit[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export { addDays };

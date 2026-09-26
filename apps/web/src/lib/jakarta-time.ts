/** Office time is WIB (Asia/Jakarta, UTC+7, no daylight saving). */
const OFFSET_MS = 7 * 60 * 60 * 1000;

export function jakartaToday(now = new Date()): { date: string; year: number; month: number } {
  const local = new Date(now.getTime() + OFFSET_MS);
  return {
    date: local.toISOString().slice(0, 10),
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
  };
}

/** ISO timestamp for a WIB wall-clock date and time. */
export function jakartaInstant(date: string, time = "00:00"): string {
  return `${date}T${time}:00+07:00`;
}

export function jakartaDateOf(iso: string): string {
  return new Date(new Date(iso).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const longDateFmt = new Intl.DateTimeFormat("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
});

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatLongDate = (date: string) => longDateFmt.format(new Date(`${date}T12:00:00+07:00`));

/** True when the instant is still ahead (server time). */
export const isUpcoming = (iso: string) => new Date(iso).getTime() > Date.now();

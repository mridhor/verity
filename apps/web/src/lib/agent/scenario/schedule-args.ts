import type { ScheduleKind } from "@/lib/labels";
import { parseDate, parseTime, stripWhen } from "./dates";

/** A schedule request in structured form: from the text parser here, or from a model's tool call. */
export type ScheduleArgs = {
  berkasId?: string;
  /** Words naming the berkas, when asked from the office view. */
  berkasQuery?: string;
  date?: string;
  time?: string;
  kind: ScheduleKind;
  location?: string;
  title?: string;
};

// Words that name the kind of appointment, not the berkas it is for.
export const SCHEDULE_WORDS = new Set(["penandatanganan", "tanda", "tangan", "ttd", "akta", "berkas", "untuk", "dengan", "pertemuan", "klien",
  "rapat", "internal", "konsultasi", "jadwal", "acara", "yang", "dan"]);

/** Meaningful words of a request: at least three letters and not an appointment word. */
export function subjectWords(subject: string) {
  return subject.split(/\s+/).map((w) => w.replace(/[%,()*]/g, "").trim()).filter((w) => w.length >= 3 && !SCHEDULE_WORDS.has(w));
}

export function scheduleKindOf(text: string): ScheduleKind {
  return /(tanda ?tangan|penandatangan|ttd)/.test(text) ? "penandatanganan" : /(internal|rapat)/.test(text) ? "internal" : "pertemuan_klien";
}

/** "penandatanganan AJB Kebagusan tanggal 10 Oktober 10.00 di Ruang Utama" → structured args. */
export function parseScheduleText(text: string, now = new Date()): ScheduleArgs {
  const t = text.toLowerCase();
  const subject = stripWhen(t);
  const words = subjectWords(subject);
  const location = t.match(/\bdi\s+(ruang[^,.;]*|kantor[^,.;]*)/)?.[1]?.trim().replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
  return {
    kind: scheduleKindOf(t),
    ...(parseDate(t, now) ? { date: parseDate(t, now)! } : {}),
    ...(parseTime(t) ? { time: parseTime(t)! } : {}),
    ...(location ? { location } : {}),
    ...(words.length ? { berkasQuery: words.join(" "), title: subject.charAt(0).toUpperCase() + subject.slice(1) } : {}),
  };
}

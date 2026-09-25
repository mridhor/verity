import { describe, expect, it } from "vitest";
import { parseDate, parseTime } from "./dates";

// Friday 2026-09-25, 10:00 WIB
const NOW = new Date("2026-09-25T03:00:00Z");

describe("parseDate", () => {
  it.each([
    ["hari ini", "2026-09-25"],
    ["besok", "2026-09-26"],
    ["lusa", "2026-09-27"],
    ["tenggat senin", "2026-09-28"],
    ["jumat depan", "2026-10-02"],
    ["29 sep", "2026-09-29"],
    ["3 januari", "2027-01-03"],
    ["29/9", "2026-09-29"],
    ["2026-10-05", "2026-10-05"],
  ])("%s → %s", (text, date) => expect(parseDate(text, NOW)).toBe(date));

  it("returns null without a date", () => expect(parseDate("minta NPWP Laras", NOW)).toBeNull());
});

describe("parseTime", () => {
  it.each([["besok 14.00", "14:00"], ["jam 9", "09:00"], ["pukul 13:30 WIB", "13:30"], ["besok", null]])(
    "%s → %s",
    (text, time) => expect(parseTime(text)).toBe(time),
  );
});

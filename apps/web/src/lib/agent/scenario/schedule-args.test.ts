import { describe, expect, it } from "vitest";
import { parseScheduleText } from "./schedule-args";

const NOW = new Date("2026-09-25T03:00:00Z"); // Friday 10:00 WIB

describe("parseScheduleText", () => {
  it("reads berkas words, date, time and room", () => {
    expect(parseScheduleText("penandatanganan AJB Kebagusan tanggal 10 Oktober 10.00 di Ruang Utama", NOW)).toEqual({
      kind: "penandatanganan", date: "2026-10-10", time: "10:00", location: "Ruang Utama",
      berkasQuery: "ajb kebagusan", title: "Penandatanganan ajb kebagusan",
    });
  });
  it("leaves out what was not said", () => {
    expect(parseScheduleText("penandatanganan", NOW)).toEqual({ kind: "penandatanganan" });
    expect(parseScheduleText("rapat internal besok", NOW)).toEqual({ kind: "internal", date: "2026-09-26" });
  });
});

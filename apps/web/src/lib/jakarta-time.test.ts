import { describe, expect, it } from "vitest";
import { jakartaDateOf, jakartaInstant, jakartaToday } from "./jakarta-time";

describe("jakarta time", () => {
  it("rolls the date over at midnight WIB, not UTC", () => {
    // 2026-12-31 17:30 UTC is 2027-01-01 00:30 WIB.
    expect(jakartaToday(new Date("2026-12-31T17:30:00Z"))).toEqual({ date: "2027-01-01", year: 2027, month: 1 });
    expect(jakartaDateOf("2026-12-31T16:59:00Z")).toBe("2026-12-31");
  });

  it("builds WIB instants", () => {
    expect(new Date(jakartaInstant("2026-09-25", "09:00")).toISOString()).toBe("2026-09-25T02:00:00.000Z");
  });
});

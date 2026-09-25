import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/masuk/sandi-baru")).toBe("/masuk/sandi-baru");
    expect(safeNext("/berkas?tab=aktivitas")).toBe("/berkas?tab=aktivitas");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined])(
    "rejects %s",
    (value) => {
      expect(safeNext(value)).toBe("/beranda");
    },
  );

  it("uses the given fallback", () => {
    expect(safeNext("https://evil.example", "/masuk")).toBe("/masuk");
  });
});

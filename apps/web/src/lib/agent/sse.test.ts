import { describe, expect, it } from "vitest";
import { createSseParser, encodeSse } from "./sse";

describe("sse", () => {
  it("round-trips events split across arbitrary chunks", () => {
    const events = [
      { type: "step", seq: 0, id: "s1", label: "Membaca berkas", status: "done" },
      { type: "text", seq: 1, blockId: "b1", delta: "Halo\nbaris dua [[c1]]" },
    ] as const;
    const wire = events.map((e) => encodeSse(e)).join("");
    const got: unknown[] = [];
    const feed = createSseParser((d) => got.push(JSON.parse(d)));
    for (let i = 0; i < wire.length; i += 7) feed(wire.slice(i, i + 7));
    expect(got).toEqual(events);
  });
});

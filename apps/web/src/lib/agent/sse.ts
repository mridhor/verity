import type { AgentEvent } from "./types";

export function encodeSse(event: AgentEvent): string {
  return `id: ${event.seq}\nevent: agent\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Incremental SSE parser: feed text chunks, get complete `data:` payloads back. */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n/g, "\n");
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");
      if (data) onData(data);
    }
  };
}

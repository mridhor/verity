/**
 * Only same-origin relative paths may be used as a post-login/post-reset destination,
 * so a crafted `?next=` cannot bounce a user to another site (open redirect).
 */
export function safeNext(value: string | null | undefined, fallback = "/berkas"): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, "http://verity.invalid");
    if (url.origin !== "http://verity.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

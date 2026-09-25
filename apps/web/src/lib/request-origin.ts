import "server-only";
import { headers } from "next/headers";

/**
 * Origin of the current request, used to build email-link redirect URLs. Supabase Auth only
 * accepts redirect targets on the project's allow-list, so a spoofed Host header cannot send
 * a reset link anywhere else; it falls back to the project's Site URL instead.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

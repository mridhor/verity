import type { CookieOptions } from "@supabase/ssr";

/** Set at sign-in: "0" when "Ingat saya" is off, so auth cookies become browser-session cookies. */
export const REMEMBER_COOKIE = "verity-remember";

export function withoutExpiry(options: CookieOptions): CookieOptions {
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest;
}

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// Email links that may land here. Anything else is rejected.
const ALLOWED_TYPES = new Set<EmailOtpType>(["recovery", "invite"]);

/**
 * Callback for Supabase Auth email links (password reset, invitation).
 *  - `?code=` : PKCE flow, the default email template. Works in the browser that asked for the link.
 *  - `?token_hash=&type=` : token-hash template (supabase/templates). Works on any device.
 * On success the user has a Supabase session and is sent to `next` (validated, same-origin only).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"), "/masuk/sandi-baru");
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type && ALLOWED_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const target = ok ? next : "/masuk/lupa-sandi?galat=tautan";
  return NextResponse.redirect(new URL(target, request.url), { status: 303 });
}

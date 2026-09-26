import { createServerClient } from "@supabase/ssr";
import { REMEMBER_COOKIE, withoutExpiry } from "@/lib/supabase/remember";
import { NextResponse, type NextRequest } from "next/server";

// Reachable with or without a session: requesting a reset link, and the email-link callback
// (which must run before any redirect, or the one-time code in the URL is lost).
const ALWAYS_OPEN = ["/masuk/lupa-sandi", "/auth/konfirmasi"];
const PASSWORD_PAGE = "/masuk/sandi-baru";

/**
 * Refreshes the Supabase session cookie and gates every page:
 * unauthenticated → /masuk; enrolled 2FA not yet completed → /masuk/mfa?next=<page>.
 * Pages re-check with requirePrincipal(); RLS is the final authority.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // "Ingat saya" off: auth cookies live only until the browser closes.
  const sessionOnly = request.cookies.get(REMEMBER_COOKIE)?.value === "0";
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, sessionOnly ? withoutExpiry(options) : options);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const path = request.nextUrl.pathname;

  const redirectTo = (to: string, next?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = next ? `?next=${encodeURIComponent(next)}` : "";
    const r = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (ALWAYS_OPEN.includes(path)) return response;
  if (!claims) return path === "/masuk" ? response : redirectTo("/masuk");

  // Office session timeout (claim from the access token hook), measured from the sign-in time in `amr`.
  const signedInAt = Math.min(...((claims.amr as { timestamp?: number }[] | undefined) ?? []).map((a) => a.timestamp ?? Infinity));
  const timeoutHours = Number(claims.session_timeout_h ?? 0);
  if (timeoutHours > 0 && Number.isFinite(signedInAt) && Date.now() / 1000 - signedInAt > timeoutHours * 3600) {
    await supabase.auth.signOut({ scope: "local" });
    const url = request.nextUrl.clone();
    url.pathname = "/masuk";
    url.search = "?sesi=habis";
    const r = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  }

  // 2FA is optional (ADR 0005): only users with a verified factor must complete it (aal2).
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsMfa = level?.nextLevel === "aal2" && claims.aal !== "aal2";
  if (needsMfa && path !== "/masuk/mfa") return redirectTo("/masuk/mfa", path === "/masuk" ? undefined : path);
  // Accounts created with an initial password must set their own first (after 2FA, if they enrolled one).
  const mustChange = (claims.app_metadata as { must_change_password?: boolean } | undefined)?.must_change_password === true;
  if (!needsMfa && mustChange && path !== PASSWORD_PAGE) {
    const r = redirectTo(PASSWORD_PAGE);
    r.headers.set("location", new URL(`${PASSWORD_PAGE}?wajib=1`, request.url).toString());
    return r;
  }
  if (!needsMfa && path === "/masuk") return redirectTo("/beranda");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/keluar).*)"],
};

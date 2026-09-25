import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable with or without a session: requesting a reset link, and the email-link callback
// (which must run before any redirect, or the one-time code in the URL is lost).
const ALWAYS_OPEN = ["/masuk/lupa-sandi", "/auth/konfirmasi"];
const MFA_ROLES = new Set(["notaris", "partner", "super_admin"]);

/**
 * Refreshes the Supabase session cookie and gates every page:
 * unauthenticated → /masuk; privileged role without aal2 → /masuk/mfa?next=<page>.
 * Pages re-check with requirePrincipal(); RLS is the final authority.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
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

  const needsMfa = MFA_ROLES.has(String(claims.app_role ?? "")) && claims.aal !== "aal2";
  if (needsMfa && path !== "/masuk/mfa") return redirectTo("/masuk/mfa", path === "/masuk" ? undefined : path);
  if (!needsMfa && (path === "/masuk" || path === "/masuk/mfa")) return redirectTo("/berkas");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/keluar).*)"],
};

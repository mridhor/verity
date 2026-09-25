import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/masuk"];
const MFA_ROLES = new Set(["notaris", "partner", "super_admin"]);

/**
 * Refreshes the Supabase session cookie and gates every page:
 * unauthenticated → /masuk; privileged role without aal2 → /masuk/mfa.
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
  const isPublic = PUBLIC_PATHS.some((p) => path === p);

  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const r = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!claims) return isPublic ? response : redirectTo("/masuk");

  const needsMfa = MFA_ROLES.has(String(claims.app_role ?? "")) && claims.aal !== "aal2";
  if (needsMfa && path !== "/masuk/mfa") return redirectTo("/masuk/mfa");
  if (!needsMfa && (path === "/masuk" || path === "/masuk/mfa")) return redirectTo("/berkas");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/keluar).*)"],
};

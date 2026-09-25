import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { env } from "@/lib/env";
import { REMEMBER_COOKIE, withoutExpiry } from "./remember";

/**
 * Server-side client acting as the signed-in user: every query runs under RLS.
 * One client per request (React cache), so layout, page and actions share it.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          const sessionOnly = cookieStore.get(REMEMBER_COOKIE)?.value === "0";
          for (const { name, value, options } of toSet) cookieStore.set(name, value, sessionOnly ? withoutExpiry(options) : options);
        } catch {
          // Called from a Server Component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
});

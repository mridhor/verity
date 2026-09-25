import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";
import { AuthCard } from "../auth-card";
import { NewPasswordForm } from "./new-password-form";

/**
 * Set a new password. Reached from a reset/invite email link (via /auth/konfirmasi), or by a
 * signed-in user changing a temporary password. Privileged roles pass MFA first (proxy.ts).
 */
export default async function SandiBaruPage() {
  const me = await getPrincipal();
  if (!me) redirect("/masuk/lupa-sandi?galat=tautan");
  return (
    <AuthCard title="Atur kata sandi baru" subtitle={me.email ? `Untuk ${me.email}` : undefined}>
      <NewPasswordForm />
      <form action="/auth/keluar" method="post" className="mt-4 text-center">
        <button className="text-[12px] text-subtle underline-offset-2 hover:underline">Batal dan keluar</button>
      </form>
    </AuthCard>
  );
}

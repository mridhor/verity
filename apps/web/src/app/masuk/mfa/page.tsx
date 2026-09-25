import { safeNext } from "@/lib/safe-next";
import { AuthCard } from "../auth-card";
import { MfaForm } from "./mfa-form";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthCard
      title="Verifikasi dua langkah"
      subtitle="Wajib untuk Notaris, Partner, dan Super Admin."
    >
      <MfaForm next={next} />
      <form action="/auth/keluar" method="post" className="mt-4 text-center">
        <button className="text-[12px] text-subtle underline-offset-2 hover:underline">Keluar</button>
      </form>
    </AuthCard>
  );
}

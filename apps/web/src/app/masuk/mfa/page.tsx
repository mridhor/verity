import Link from "next/link";
import { getPrincipal } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";
import { AuthCard } from "../auth-card";
import { MfaForm } from "./mfa-form";

export const metadata = { title: "Verifikasi dua langkah" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const me = await getPrincipal();
  // Optional (ADR 0005): someone setting it up by choice may leave; an enrolled user must verify.
  const optional = !!me && !me.mfaEnrolled;
  return (
    <AuthCard
      title="Verifikasi dua langkah"
      subtitle={optional
        ? "Opsional, tetapi disarankan. Setelah dipasang, kode dari aplikasi autentikator diminta setiap kali masuk."
        : "Masukkan kode 6 digit dari aplikasi autentikator Anda."}
    >
      <MfaForm next={next} />
      {optional && (
        <div className="mt-4 text-center">
          <Link href={next} className="text-[12.5px] text-muted-foreground underline-offset-2 hover:underline">Nanti saja</Link>
        </div>
      )}
      <form action="/auth/keluar" method="post" className="mt-4 text-center">
        <button className="text-[12px] text-subtle underline-offset-2 hover:underline">Keluar</button>
      </form>
    </AuthCard>
  );
}

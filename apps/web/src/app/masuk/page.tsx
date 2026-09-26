import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Masuk" };

export default async function MasukPage({ searchParams }: { searchParams: Promise<{ sesi?: string }> }) {
  const expired = (await searchParams).sesi === "habis";
  return (
    <AuthCard title="Masuk" subtitle="Gunakan akun yang dibuat oleh administrator kantor.">
      {expired && (
        <p role="status" className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning">
          Sesi Anda berakhir sesuai batas waktu kantor. Silakan masuk kembali.
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}

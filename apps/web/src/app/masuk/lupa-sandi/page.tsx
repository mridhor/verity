import { AuthCard } from "../auth-card";
import { ResetRequestForm } from "./reset-request-form";

export const metadata = { title: "Lupa kata sandi" };

const LINK_ERRORS: Record<string, string> = {
  tautan: "Tautan atur ulang tidak berlaku lagi atau sudah dipakai. Minta tautan baru di bawah.",
};

export default async function LupaSandiPage({ searchParams }: { searchParams: Promise<{ galat?: string }> }) {
  const error = LINK_ERRORS[(await searchParams).galat ?? ""];
  return (
    <AuthCard title="Lupa kata sandi" subtitle="Kami akan mengirim tautan untuk mengatur kata sandi baru.">
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-border-soft px-3 py-2 text-[12.5px] text-destructive">
          {error}
        </p>
      )}
      <ResetRequestForm />
    </AuthCard>
  );
}

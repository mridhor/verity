import { AuthCard } from "../masuk/auth-card";

export default function TanpaAksesPage() {
  return (
    <AuthCard title="Akun belum terhubung ke kantor">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Anda sudah masuk, tetapi akun ini belum ditambahkan ke kantor oleh Super Admin. Hubungi administrator, lalu
        masuk kembali.
      </p>
      <form action="/auth/keluar" method="post" className="mt-5">
        <button className="text-[12.5px] underline-offset-2 hover:underline">Keluar</button>
      </form>
    </AuthCard>
  );
}

import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";

export default function MasukPage() {
  return (
    <AuthCard title="Masuk" subtitle="Gunakan akun yang dibuat oleh administrator kantor.">
      <LoginForm />
    </AuthCard>
  );
}

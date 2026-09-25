export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center font-serif text-[26px] font-semibold tracking-tight">Verity</div>
        <div className="rounded-[10px] border border-border bg-card p-6">
          <h1 className="font-serif text-xl font-medium">{title}</h1>
          {subtitle && <p className="mt-1 text-[12.5px] text-muted-foreground">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="mt-4 text-center text-[11.5px] text-subtle">
          Sistem internal kantor. Akses dan setiap tindakan dicatat.
        </p>
      </div>
    </main>
  );
}

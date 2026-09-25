import Link from "next/link";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3.5">
      <div className="font-serif text-[26px] leading-tight tabular-nums">{value}</div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">{label}</div>
      {sub && <div className="mt-1 text-[11.5px] text-subtle">{sub}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-14 text-center text-[13px] text-subtle">{children}</p>;
}

export function Section({ title, actions, children, className }: {
  title: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-2.5">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** Filter chips driven by a search param, so filters work without client JavaScript. */
export function FilterChips({ base, param, value, options, extra }: {
  base: string; param: string; value: string | undefined;
  options: { value: string; label: string }[]; extra?: Record<string, string | undefined>;
}) {
  const href = (v: string | undefined) => {
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(extra ?? {})) if (val) q.set(k, val);
    if (v) q.set(param, v);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const all = [{ value: "", label: "Semua" }, ...options];
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((o) => {
        const active = (value ?? "") === o.value;
        return (
          <Link
            key={o.value || "all"}
            href={href(o.value || undefined)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground hover:border-subtle",
              active && "border-foreground bg-foreground text-card hover:border-foreground",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

export function SearchForm({ action, value, placeholder, hidden }: {
  action: string; value?: string; placeholder: string; hidden?: Record<string, string | undefined>;
}) {
  return (
    <form action={action} className="w-full max-w-xs" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-full rounded-md border border-border bg-card px-3 text-[13px] placeholder:text-subtle focus-visible:border-subtle"
      />
    </form>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-background text-left text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const td = "border-t border-border-soft px-4 py-2.5 align-top";

export function Textarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn("min-h-16 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-subtle focus-visible:border-subtle", props.className)}
    />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[12.5px] text-destructive">{message}</p>;
}

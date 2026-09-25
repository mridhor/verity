import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Soft-filled figure card (large serif number over a quiet label). */
export function StatCard({ label, value, sub, delta, href }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode;
  delta?: { text: string; direction: "up" | "down" | "flat" }; href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-[34px] leading-none tracking-[-0.02em] tabular-nums">{value}</span>
        {delta && (
          <span className={cn("inline-flex items-center text-[12.5px] font-medium tabular-nums",
            delta.direction === "up" ? "text-success" : delta.direction === "down" ? "text-destructive" : "text-subtle")}>
            {delta.direction === "up" ? <ArrowUpRight size={13} /> : delta.direction === "down" ? <ArrowDownRight size={13} /> : null}
            {delta.text}
          </span>
        )}
      </div>
      <div className="mt-2.5 text-[13px] text-muted-foreground">{label}</div>
      {sub && <div className="mt-1 text-[12px] text-subtle">{sub}</div>}
    </>
  );
  const cls = "block rounded-xl bg-muted px-5 py-[18px] transition-colors";
  return href ? <Link href={href} className={cn(cls, "hover:bg-accent")}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function EmptyState({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-[13px] text-subtle">
      {icon && <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">{icon}</span>}
      <p className="max-w-sm">{children}</p>
    </div>
  );
}

export function Section({ title, description, actions, children, className }: {
  title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-2.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium">{title}</h2>
          {description && <p className="mt-0.5 text-[12.5px] text-subtle">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="px-5 pb-4">{children}</div>
    </section>
  );
}

/** Segmented filters driven by a search param, so they work without client JavaScript. */
export function FilterChips({ base, param, value, options, extra }: {
  base: string; param: string; value: string | undefined;
  options: { value: string; label: string; count?: number }[]; extra?: Record<string, string | undefined>;
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
    <div className="flex flex-wrap gap-1">
      {all.map((o) => {
        const active = (value ?? "") === o.value;
        return (
          <Link
            key={o.value || "all"}
            href={href(o.value || undefined)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {o.label}
            {"count" in o && o.count !== undefined && <span className="ml-1 text-subtle tabular-nums">({o.count})</span>}
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
    <form action={action} className="relative w-full max-w-xs" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        name="q"
        defaultValue={value}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-card pr-3 pl-8.5 text-[13px] shadow-card placeholder:text-subtle focus-visible:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-foreground/[0.06] focus-visible:outline-none"
      />
    </form>
  );
}

/** Airy table: rounded soft header bar, generous rows, hairline dividers. */
export function Table({ head, children, className }: { head: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[12.5px] text-muted-foreground">
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className={cn("bg-muted px-4 py-2.5 font-medium whitespace-nowrap first:rounded-l-lg last:rounded-r-lg")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:first-child>td]:border-t-0 [&>tr]:transition-colors [&>tr:hover]:bg-muted/45">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "border-t border-border-soft px-4 py-3.5 align-middle";

export function Textarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={cn("min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-card placeholder:text-subtle focus-visible:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-foreground/[0.06] focus-visible:outline-none", props.className)}
    />
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-destructive-soft px-3 py-2 text-[12.5px] text-destructive">{message}</p>;
}

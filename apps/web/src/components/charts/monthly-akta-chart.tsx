import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Categorical slots 1 and 2 of the validated data-viz palette (dataviz skill: validate_palette.js,
// light surface, all checks pass). Identity only; text never takes these colours.
const SERIES = [
  { key: "notaris", label: "Notaris", color: "#2a78d6" },
  { key: "ppat", label: "PPAT", color: "#eb6834" },
] as const;

export type MonthCount = { notaris: number; ppat: number };

const PLOT_H = 180;

/** Integer step of 1, 2 or 5 × 10ⁿ so four intervals cover the largest value (counts, no fractions). */
function niceStep(v: number) {
  const raw = Math.max(1, Math.ceil(v / 4));
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].find((s) => s * pow >= raw)! * pow;
}

/**
 * Final akta per month, stacked by appointment (Notaris, PPAT). One y-axis, recessive grid,
 * 4px rounded top on the bar, 2px surface gap between segments, the monthly average as a dashed
 * reference, a tooltip per month on hover/focus, and a table for screen readers.
 */
export function MonthlyAktaChart({ data, year, currentMonth }: { data: MonthCount[]; year: number; currentMonth: number }) {
  const totals = data.map((d) => d.notaris + d.ppat);
  const elapsed = data.slice(0, currentMonth);
  const sum = totals.reduce((a, b) => a + b, 0);
  const avg = elapsed.length ? sum / elapsed.length : 0;
  const step = niceStep(Math.max(1, ...totals));
  const max = step * 4;
  const ticks = Array.from({ length: 5 }, (_, i) => step * i);
  const peakIndex = totals.indexOf(Math.max(...totals));
  const px = (n: number) => (n / max) * PLOT_H;
  const byKey = { notaris: data.reduce((a, d) => a + d.notaris, 0), ppat: data.reduce((a, d) => a + d.ppat, 0) };
  const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[32px] leading-none tracking-[-0.02em] tabular-nums">{sum}</span>
            <span className="text-[13px] text-muted-foreground">akta final sepanjang {year}</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-subtle">
            Rata-rata {fmt(avg)} per bulan{sum > 0 && ` · terbanyak ${MONTHS_LONG[peakIndex]} (${totals[peakIndex]})`}
          </div>
        </div>
        <ul className="flex items-center gap-4 text-[12.5px] text-muted-foreground" aria-label="Legenda">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label} <span className="text-foreground tabular-nums">{byKey[s.key]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        {/* y-axis */}
        <div aria-hidden className="relative w-5 shrink-0 text-right text-[11px] text-subtle tabular-nums" style={{ height: PLOT_H }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: px(t) }}>{fmt(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* grid and baseline */}
          <div className="relative" style={{ height: PLOT_H }}>
            {ticks.map((t) => (
              <div key={t} className={cn("absolute inset-x-0 border-t", t === 0 ? "border-border" : "border-border-soft")} style={{ bottom: px(t) }} />
            ))}
            {avg > 0 && (
              <div aria-hidden className="absolute inset-x-0 z-[1] border-t border-dashed border-muted-foreground/60" style={{ bottom: px(avg) }}>
                <span className="absolute -top-[9px] right-0 bg-card pl-1.5 text-[11px] text-muted-foreground">rata-rata {fmt(avg)}</span>
              </div>
            )}
            {/* bars */}
            <div className="absolute inset-0 flex items-end gap-1.5">
              {data.map((d, i) => {
                const total = totals[i]!;
                const future = i + 1 > currentMonth;
                const labelled = total > 0 && (i + 1 === currentMonth || i === peakIndex);
                return (
                  <div key={MONTHS[i]} tabIndex={future ? -1 : 0}
                    aria-label={future ? undefined : `${MONTHS_LONG[i]} ${year}: Notaris ${d.notaris}, PPAT ${d.ppat}, total ${total}`}
                    aria-hidden={future || undefined}
                    className="group relative flex h-full flex-1 flex-col items-center justify-end rounded-md outline-none focus-visible:bg-muted/60 hover:bg-muted/50">
                    {labelled && <span className="mb-1 text-[11px] font-medium text-foreground tabular-nums">{total}</span>}
                    {total > 0 ? (
                      <div className="flex w-full max-w-8 flex-col-reverse gap-[2px]" style={{ height: px(total) + (d.notaris && d.ppat ? 2 : 0) }}>
                        {d.notaris > 0 && <div className={cn(!d.ppat && "rounded-t-[4px]")} style={{ height: px(d.notaris), background: SERIES[0].color }} />}
                        {d.ppat > 0 && <div className="rounded-t-[4px]" style={{ height: px(d.ppat), background: SERIES[1].color }} />}
                      </div>
                    ) : !future ? (
                      <div className="h-[2px] w-full max-w-8 rounded-full bg-border" />
                    ) : null}
                    {!future && (
                      <div aria-hidden
                        className="pointer-events-none invisible absolute bottom-full z-10 mb-1 w-max rounded-lg bg-foreground px-3 py-2 text-[12px] text-card opacity-0 shadow-pop transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
                        style={{ bottom: Math.min(px(total) + 8, PLOT_H - 20) }}>
                        <div className="mb-1 font-medium">{MONTHS_LONG[i]} {year}</div>
                        {SERIES.map((s) => (
                          <div key={s.key} className="flex items-center gap-2">
                            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: s.color }} />
                            <span className="flex-1 text-card/80">{s.label}</span>
                            <span className="tabular-nums">{d[s.key]}</span>
                          </div>
                        ))}
                        <div className="mt-1 flex justify-between border-t border-card/20 pt-1"><span className="text-card/80">Total</span><span className="tabular-nums">{total}</span></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* x-axis */}
          <div aria-hidden className="mt-2 flex gap-1.5">
            {data.map((_, i) => (
              <span key={MONTHS[i]} className={cn("flex-1 text-center text-[11px]",
                i + 1 === currentMonth ? "font-medium text-foreground" : i + 1 > currentMonth ? "text-subtle/60" : "text-subtle")}>
                {MONTHS[i]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Akta final per bulan tahun {year}, per jenis pengangkatan</caption>
        <thead><tr><th>Bulan</th><th>Notaris</th><th>PPAT</th><th>Total</th></tr></thead>
        <tbody>
          {data.slice(0, currentMonth).map((d, i) => (
            <tr key={MONTHS[i]}><td>{MONTHS_LONG[i]}</td><td>{d.notaris}</td><td>{d.ppat}</td><td>{totals[i]}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

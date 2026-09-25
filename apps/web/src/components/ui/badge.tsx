import { cn } from "@/lib/utils";

// Status pills. Violet is not a status colour (it marks authority: citations, approvals, stamps).
const TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-destructive-soft text-destructive",
  authority: "bg-primary-soft text-primary",
} as const;
export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", dot = true, className, children }: {
  tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-medium leading-4", TONES[tone], className)}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const AKTA_STATUS_TONE = {
  draft: "neutral",
  verifikasi: "info",
  menunggu_ttd: "warning",
  selesai: "success",
  diarsipkan: "neutral",
} as const satisfies Record<string, BadgeTone>;

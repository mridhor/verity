import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-border-soft text-muted-foreground",
  info: "bg-primary-soft text-primary",
  warning: "bg-[#f6ecd9] text-warning",
  success: "bg-[#e3efe7] text-success",
  danger: "bg-[#f5e3e0] text-destructive",
} as const;
export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-medium", TONES[tone], className)}>
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

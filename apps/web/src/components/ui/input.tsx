import { cn } from "@/lib/utils";

const field =
  "h-9 w-full rounded-lg border border-input bg-card text-sm text-foreground shadow-card placeholder:text-subtle " +
  "focus-visible:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-foreground/[0.06] focus-visible:outline-none " +
  "disabled:bg-muted disabled:text-subtle";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(field, "px-3", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(field, "px-2.5", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[12.5px] font-medium text-muted-foreground", className)} {...props} />;
}

export function Dot({ tone = "subtle" }: { tone?: "subtle" | "success" | "warning" | "destructive" | "primary" | "info" }) {
  const color = {
    subtle: "bg-subtle",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    primary: "bg-primary",
    info: "bg-info",
  }[tone];
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", color)} />;
}

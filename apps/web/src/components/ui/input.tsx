import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground placeholder:text-subtle focus-visible:border-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn("h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm text-foreground", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[12.5px] text-muted-foreground", className)} {...props} />;
}

export function Dot({ tone = "subtle" }: { tone?: "subtle" | "success" | "warning" | "destructive" | "primary" }) {
  const color = {
    subtle: "bg-subtle",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    primary: "bg-primary",
  }[tone];
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", color)} />;
}

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Violet only for authoritative actions (approve, verify, finalize).
        primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
        default: "border border-border bg-card text-foreground shadow-card hover:bg-muted",
        ink: "bg-foreground text-card shadow-card hover:bg-foreground/85",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "border border-border bg-card text-destructive shadow-card hover:bg-destructive-soft",
      },
      size: { default: "h-9 px-3.5", sm: "h-7 px-2.5 text-[12px]", icon: "size-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

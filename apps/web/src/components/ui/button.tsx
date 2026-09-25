import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Violet only for authoritative actions (approve, verify, finalize).
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        default: "border border-border bg-card text-foreground hover:border-subtle",
        ink: "bg-foreground text-card hover:bg-foreground/90",
        ghost: "text-muted-foreground hover:bg-border-soft hover:text-foreground",
        danger: "border border-border bg-card text-destructive hover:border-destructive",
      },
      size: { default: "h-8 px-3", sm: "h-7 px-2.5 text-xs", icon: "h-8 w-8" },
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

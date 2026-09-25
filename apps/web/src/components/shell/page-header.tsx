export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className={children ? "border-b border-border-soft px-8 pt-7" : "px-8 pt-7 pb-1"}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <div className="mb-2 text-[13px] text-subtle">{eyebrow}</div>}
          <h1 className="font-serif text-[34px] leading-[1.12] font-normal tracking-[-0.022em]">{title}</h1>
          {meta && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

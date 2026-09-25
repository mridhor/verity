export function PageHeader({
  eyebrow,
  title,
  meta,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-border bg-background px-8 pt-[22px]">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-[12.5px] text-subtle">{eyebrow}</div>}
          <h1 className="font-serif text-[27px] font-medium tracking-[-0.01em]">{title}</h1>
          {meta && <div className="mt-2 flex flex-wrap gap-[22px] text-[12.5px] text-muted-foreground">{meta}</div>}
        </div>
        {actions}
      </div>
      {children ?? <div className="h-5" />}
    </header>
  );
}

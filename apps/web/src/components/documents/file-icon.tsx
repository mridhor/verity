import { cn } from "@/lib/utils";

const STYLE: Record<string, string> = {
  PDF: "bg-[#fbe9e7] text-[#c0392b]",
  DOCX: "bg-[#e8effc] text-[#2556c4]",
  PNG: "bg-[#eaf4ee] text-[#2c7048]",
  JPG: "bg-[#eaf4ee] text-[#2c7048]",
};

/** Small file-type tile (PDF red, Word blue, images green), as in document lists. */
export function FileIcon({ format, className }: { format: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg text-[9.5px] font-semibold tracking-wide",
      STYLE[format] ?? "bg-muted text-muted-foreground", className)}>
      {format === "Lainnya" ? "FILE" : format}
    </span>
  );
}

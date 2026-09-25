"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Properties, Sheet } from "@/components/ui/sheet";
import { FileIcon } from "./file-icon";

export type PreviewDoc = {
  id: string; title: string; fileName: string; format: string; type: string; size: string; uploaded: string;
  uploader: string; berkas?: { id: string; title: string } | null; akta?: { id: string; label: string } | null;
};

/** "Lihat": the file and its record side by side in a panel; every opening is logged. */
export function DocumentPreviewButton({ doc }: { doc: PreviewDoc }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const inline = doc.format === "PDF" || doc.format === "PNG" || doc.format === "JPG";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground">
        <Eye size={13} /> Lihat
      </button>
      <Sheet open={open} onClose={close} title={doc.title} subtitle={doc.fileName} width="lg"
        actions={
          <Link href={`/dokumen/${doc.id}/unduh`} prefetch={false}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium shadow-card hover:bg-muted">
            <Download size={13} /> Unduh
          </Link>
        }>
        <div className="grid gap-6 px-6 py-5">
          <div className="flex items-center gap-3">
            <FileIcon format={doc.format} />
            <Badge tone={doc.type === "Minuta" ? "success" : "neutral"}>{doc.type}</Badge>
            <span className="text-[12.5px] text-subtle">{doc.format} · {doc.size}</span>
          </div>
          <Properties items={[
            { label: "Berkas", value: doc.berkas ? <Link className="hover:underline" href={`/berkas/${doc.berkas.id}?tab=dokumen`}>{doc.berkas.title}</Link> : "—" },
            { label: "Akta", value: doc.akta ? <Link className="hover:underline" href={`/akta/${doc.akta.id}`}>{doc.akta.label}</Link> : "—" },
            { label: "Diunggah", value: `${doc.uploaded} · ${doc.uploader}` },
            { label: "Akses", value: <span className="text-muted-foreground">Setiap pembukaan dan unduhan dicatat di audit log.</span> },
          ]} />
          {doc.format === "PDF" && (
            <a href={`/dokumen/${doc.id}/lihat`} target="_blank" rel="noopener" className="-mt-2 text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              PDF tidak tampil? Buka di tab baru
            </a>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-muted">
            {inline ? (
              doc.format === "PDF"
                ? <iframe title={`Pratinjau ${doc.title}`} src={`/dokumen/${doc.id}/lihat`} className="h-[62vh] w-full bg-card" />
                // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL
                : <img src={`/dokumen/${doc.id}/lihat`} alt={`Pratinjau ${doc.title}`} className="mx-auto max-h-[62vh] object-contain" />
            ) : (
              <p className="px-6 py-16 text-center text-[13px] text-subtle">Pratinjau tidak tersedia untuk {doc.format}. Unduh untuk membukanya.</p>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}

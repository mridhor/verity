import Link from "next/link";
import { Download } from "lucide-react";
import { Table, td } from "@/components/ui/blocks";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPE_LABEL, fileFormat, formatAktaNumber, formatBytes, type DocumentType } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { DocumentPreviewButton } from "./document-preview";
import { FileIcon } from "./file-icon";

export type DocumentRow = {
  id: string; title: string; doc_type: string; file_name: string; mime_type: string; size_bytes: number;
  uploaded_at: string; uploaded_by: string; berkas?: { id: string; title: string } | null;
  akta?: { id: string; title: string; number: number | null; number_period: string | null } | null;
};

export function DocumentTable({ rows, nameOf, showBerkas = true }: {
  rows: DocumentRow[]; nameOf: Map<string, string>; showBerkas?: boolean;
}) {
  return (
    <Table head={["Dokumen", "Jenis", ...(showBerkas ? ["Berkas"] : []), "Akta", "Diunggah", ""]}>
      {rows.map((d) => {
        const format = fileFormat(d.mime_type);
        const aktaLabel = d.akta ? formatAktaNumber(d.akta.number, d.akta.number_period) ?? "Draft" : null;
        return (
          <tr key={d.id}>
            <td className={`${td} min-w-64`}>
              <div className="flex items-center gap-3">
                <FileIcon format={format} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{d.title}</div>
                  <div className="truncate text-[12px] text-subtle">{d.file_name} · {formatBytes(d.size_bytes)}</div>
                </div>
              </div>
            </td>
            <td className={td}><Badge dot={false} tone={d.doc_type === "minuta" ? "success" : "neutral"}>{DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}</Badge></td>
            {showBerkas && (
              <td className={`${td} max-w-56`}>
                {d.berkas ? <Link href={`/berkas/${d.berkas.id}?tab=dokumen`} className="block truncate hover:underline">{d.berkas.title}</Link> : "—"}
              </td>
            )}
            <td className={`${td} whitespace-nowrap text-muted-foreground tabular-nums`}>
              {d.akta ? <Link href={`/akta/${d.akta.id}`} className="hover:underline" title={d.akta.title}>{aktaLabel}</Link> : <span className="text-subtle">—</span>}
            </td>
            <td className={`${td} text-muted-foreground whitespace-nowrap`}>
              {formatDate(d.uploaded_at)}
              <div className="text-[12px] text-subtle">{nameOf.get(d.uploaded_by) ?? "—"}</div>
            </td>
            <td className={`${td} text-right whitespace-nowrap`}>
              <DocumentPreviewButton doc={{
                id: d.id, title: d.title, fileName: d.file_name, format, size: formatBytes(d.size_bytes),
                type: DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType], uploaded: formatDate(d.uploaded_at),
                uploader: nameOf.get(d.uploaded_by) ?? "—", berkas: d.berkas ?? null,
                akta: d.akta ? { id: d.akta.id, label: `${aktaLabel} · ${d.akta.title}` } : null,
              }} />
              <Link href={`/dokumen/${d.id}/unduh`} prefetch={false} aria-label={`Unduh ${d.title}`}
                className="ml-1 inline-grid size-7 place-items-center rounded-lg text-muted-foreground align-middle hover:bg-muted hover:text-foreground">
                <Download size={13} />
              </Link>
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

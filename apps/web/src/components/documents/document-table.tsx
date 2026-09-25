import Link from "next/link";
import { Table, td } from "@/components/ui/blocks";
import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPE_LABEL, fileFormat, formatBytes, type DocumentType } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export type DocumentRow = {
  id: string; title: string; doc_type: string; file_name: string; mime_type: string; size_bytes: number;
  uploaded_at: string; uploaded_by: string; berkas?: { id: string; title: string } | null;
};

export function DocumentTable({ rows, nameOf, showBerkas = true }: {
  rows: DocumentRow[]; nameOf: Map<string, string>; showBerkas?: boolean;
}) {
  return (
    <Table head={["Dokumen", "Jenis", "Format", ...(showBerkas ? ["Berkas"] : []), "Diunggah", ""]}>
      {rows.map((d) => (
        <tr key={d.id} className="hover:bg-border-soft/50">
          <td className={td}>
            <div className="font-medium">{d.title}</div>
            <div className="text-[11.5px] text-subtle">{d.file_name} · {formatBytes(d.size_bytes)}</div>
          </td>
          <td className={td}><Badge tone={d.doc_type === "minuta" ? "info" : "neutral"}>{DOCUMENT_TYPE_LABEL[d.doc_type as DocumentType]}</Badge></td>
          <td className={`${td} text-muted-foreground`}>{fileFormat(d.mime_type)}</td>
          {showBerkas && (
            <td className={td}>
              {d.berkas ? <Link href={`/berkas/${d.berkas.id}?tab=dokumen`} className="hover:underline">{d.berkas.title}</Link> : "—"}
            </td>
          )}
          <td className={`${td} text-muted-foreground whitespace-nowrap`}>
            {formatDate(d.uploaded_at)}
            <div className="text-[11.5px] text-subtle">{nameOf.get(d.uploaded_by) ?? "—"}</div>
          </td>
          <td className={`${td} text-right`}>
            <Link href={`/dokumen/${d.id}/unduh`} prefetch={false} className="text-[12.5px] text-muted-foreground hover:text-foreground">Unduh</Link>
          </td>
        </tr>
      ))}
    </Table>
  );
}

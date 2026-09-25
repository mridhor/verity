"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton, useCloseDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { createClient } from "@/lib/supabase/client";
import { registerDocument } from "./actions";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword";

type Option = { id: string; label: string };

/**
 * Uploads straight to Supabase Storage with the user's own session (storage RLS checks the
 * berkas), then records the document. The service never sees a secret key.
 */
type Props = { tenantId: string; berkas: Option[]; akta?: (Option & { berkasId: string })[]; fixedBerkas?: string };

export function UploadForm(props: Props) {
  return (
    <DialogButton variant="ink" icon={<Upload size={14} />} label="Unggah dokumen" title="Unggah dokumen" size="lg"
      description="File disimpan privat; setiap unduhan tercatat di audit.">
      <UploadBody {...props} />
    </DialogButton>
  );
}

function UploadBody({ tenantId, berkas, akta = [], fixedBerkas }: Props) {
  const router = useRouter();
  const close = useCloseDialog();
  const [berkasId, setBerkasId] = useState(fixedBerkas ?? "");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Pilih file.");
    if (file.size > MAX_BYTES) return setError("Ukuran file maksimal 25 MB.");
    if (!ACCEPT.split(",").includes(file.type)) return setError("Format yang diterima: PDF, JPG, PNG, DOC, DOCX.");
    if (!berkasId) return setError("Pilih berkas.");
    setBusy(true);
    setError(undefined);
    const safeName = file.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-120) || "dokumen";
    const path = `${tenantId}/${berkasId}/${crypto.randomUUID()}/${safeName}`;
    const { error: upErr } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setError("Unggah gagal. Pastikan Anda anggota berkas ini, lalu coba lagi.");
    }
    const res = await registerDocument({
      berkasId, aktaId: String(form.get("aktaId") ?? ""), docType: String(form.get("docType")),
      title: String(form.get("title") ?? ""), fileName: file.name, storagePath: path,
      mimeType: file.type, sizeBytes: String(file.size),
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    close();
    router.refresh();
  }

  const aktaOptions = akta.filter((a) => a.berkasId === berkasId);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      {!fixedBerkas && (
        <div className="col-span-2">
          <Label htmlFor="berkas">Berkas</Label>
          <Select id="berkas" value={berkasId} onChange={(e) => setBerkasId(e.target.value)} required>
            <option value="" disabled>Pilih berkas</option>
            {berkas.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
        </div>
      )}
      <div>
        <Label htmlFor="docType">Jenis dokumen</Label>
        <Select id="docType" name="docType" defaultValue="ktp">
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>)}
        </Select>
      </div>
      <div>
        <Label htmlFor="aktaId">Akta (opsional)</Label>
        <Select id="aktaId" name="aktaId" defaultValue="" disabled={!aktaOptions.length}>
          <option value="">—</option>
          {aktaOptions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
      </div>
      <div className="col-span-2">
        <Label htmlFor="title">Judul (opsional)</Label>
        <Input id="title" name="title" placeholder="KTP Laras Anggraini" />
      </div>
      <div className="col-span-2">
        <Label htmlFor="file">File (maks. 25 MB)</Label>
        <input id="file" name="file" type="file" accept={ACCEPT} required className="block w-full text-[13px] file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-[12.5px]" />
      </div>
      <div className="col-span-full">
        <FormError message={error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={busy}>{busy ? "Mengunggah…" : "Unggah"}</Button>
        </DialogActions>
      </div>
    </form>
  );
}

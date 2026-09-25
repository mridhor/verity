"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseDialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { attachLegalFile } from "../actions";

/** Upload the regulation's PDF to the private `legal` bucket with the user's session, then attach it. */
export function AttachLegalFile({ tenantId, referenceId, hasFile }: { tenantId: string; referenceId: string; hasFile: boolean }) {
  return (
    <DialogButton buttonSize="sm" icon={<Paperclip size={13} />} label={hasFile ? "Ganti PDF" : "Lampirkan PDF"} title="Lampirkan PDF peraturan" size="sm"
      description="Salinan resmi dari sumber pemerintah. Maksimal 25 MB.">
      <Body tenantId={tenantId} referenceId={referenceId} />
    </DialogButton>
  );
}

function Body({ tenantId, referenceId }: { tenantId: string; referenceId: string }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const file = new FormData(e.currentTarget).get("file");
      if (!(file instanceof File) || file.size === 0) return setError("Pilih file PDF.");
      if (file.type !== "application/pdf") return setError("Hanya PDF.");
      if (file.size > 25 * 1024 * 1024) return setError("Maksimal 25 MB.");
      setBusy(true); setError(undefined);
      const safe = file.name.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").slice(-100) || "peraturan.pdf";
      const path = `${tenantId}/${referenceId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await createClient().storage.from("legal").upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upErr) { setBusy(false); return setError("Unggah gagal."); }
      const res = await attachLegalFile(referenceId, path);
      setBusy(false);
      if (res.error) return setError(res.error);
      close(); router.refresh();
    }}>
      <div>
        <Label htmlFor="legal-file">File PDF</Label>
        <input id="legal-file" name="file" type="file" accept="application/pdf" required
          className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-[12.5px]" />
      </div>
      <FormError message={error} />
      <DialogActions><Button type="submit" variant="ink" disabled={busy}>{busy ? "Mengunggah…" : "Lampirkan"}</Button></DialogActions>
    </form>
  );
}

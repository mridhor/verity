"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePrincipal } from "@/lib/auth";
import { dbMessage } from "@/lib/db-errors";
import { DOCUMENT_TYPES } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  berkasId: z.uuid(),
  aktaId: z.union([z.uuid(), z.literal("")]).optional(),
  docType: z.enum(DOCUMENT_TYPES),
  title: z.string().trim().max(200).optional(),
  fileName: z.string().min(1).max(255),
  storagePath: z.string().min(10).max(500),
  mimeType: z.string().min(3),
  sizeBytes: z.coerce.number().int().positive(),
});

/** Records a file the browser has already uploaded to the private `documents` bucket. */
export async function registerDocument(input: Record<string, string>): Promise<{ error?: string }> {
  const me = await requirePrincipal();
  const p = schema.safeParse(input);
  if (!p.success) return { error: "Data dokumen tidak valid." };
  if (!p.data.storagePath.startsWith(`${me.tenantId}/${p.data.berkasId}/`)) return { error: "Lokasi file tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_document", {
    p_berkas: p.data.berkasId, p_akta: p.data.aktaId || null, p_doc_type: p.data.docType,
    p_title: p.data.title || p.data.fileName, p_file_name: p.data.fileName, p_storage_path: p.data.storagePath,
    p_mime_type: p.data.mimeType, p_size_bytes: p.data.sizeBytes,
  });
  if (error) return { error: dbMessage(error, "Dokumen gagal dicatat.") };
  revalidatePath("/dokumen");
  revalidatePath(`/berkas/${p.data.berkasId}`);
  return {};
}

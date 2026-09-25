import { NextResponse, type NextRequest } from "next/server";
import { getPrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const INLINE = new Set(["application/pdf", "image/png", "image/jpeg"]);

/**
 * Preview: same as download (the read is logged first, PRD-H-03) but served inline so the
 * browser can show it, through a 60-second signed URL made with the user's own session.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getPrincipal();
  if (!me) return NextResponse.redirect(new URL("/masuk", request.url));
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("mime_type").eq("id", id).maybeSingle();
  if (!doc || !INLINE.has(doc.mime_type)) return new NextResponse("Pratinjau tidak tersedia untuk format ini.", { status: 415 });
  const { data: path, error } = await supabase.rpc("log_document_access", { p_document: id });
  if (error || typeof path !== "string") return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60);
  if (!signed?.signedUrl) return new NextResponse("Dokumen tidak dapat dibuka.", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 303 });
}

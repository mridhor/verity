import { NextResponse, type NextRequest } from "next/server";
import { getPrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Download: logs the read (PRD-H-03) through the database, then redirects to a 60-second signed
 * URL created with the user's own session, so storage RLS decides access again.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getPrincipal();
  if (!me) return NextResponse.redirect(new URL("/masuk", request.url));
  const { id } = await params;
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("log_document_access", { p_document: id });
  if (error || typeof path !== "string") return new NextResponse("Dokumen tidak ditemukan.", { status: 404 });
  const fileName = path.split("/").pop() ?? "dokumen";
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60, { download: fileName });
  if (!signed?.signedUrl) return new NextResponse("Dokumen tidak dapat dibuka.", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 303 });
}

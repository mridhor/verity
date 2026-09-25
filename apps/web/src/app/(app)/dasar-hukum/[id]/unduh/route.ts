import { NextResponse, type NextRequest } from "next/server";
import { getPrincipal } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Download of an attached regulation PDF; logged (legal.downloaded) before a short-lived URL is issued. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getPrincipal();
  if (!me) return NextResponse.redirect(new URL("/masuk", request.url));
  const { id } = await params;
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("log_legal_download", { p_reference: id });
  if (error || typeof path !== "string") return new NextResponse("Berkas peraturan tidak ditemukan.", { status: 404 });
  const { data: signed } = await supabase.storage.from("legal").createSignedUrl(path, 60, { download: path.split("/").pop() ?? "peraturan.pdf" });
  if (!signed?.signedUrl) return new NextResponse("Berkas peraturan tidak dapat dibuka.", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 303 });
}

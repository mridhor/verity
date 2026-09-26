import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { agentActionSchema } from "@verity/schema-ts";
import { contextKey } from "@/lib/agent/context-key";
import { getAgentProvider } from "@/lib/agent/providers";
import { encodeSse } from "@/lib/agent/sse";
import type { AgentAction, AgentContext, AgentEvent } from "@/lib/agent/types";
import { getPrincipal, needsMfa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const contextSchema = z.union([
  z.object({ kind: z.literal("kantor"), label: z.string().max(200), page: z.enum(["beranda", "jadwal", "register", "dokumen", "dasar_hukum", "lainnya"]).optional() }),
  z.object({ kind: z.literal("berkas"), label: z.string().max(200), berkasId: z.uuid() }),
  z.object({ kind: z.literal("akta"), label: z.string().max(200), berkasId: z.uuid(), aktaId: z.uuid() }),
]);
const bodySchema = z.object({
  threadId: z.uuid().optional(), message: z.string().trim().min(1).max(2000), context: contextSchema,
  /** The answer to a widget; `message` is its readable summary, stored as the user's message. */
  action: agentActionSchema.optional(),
});

/**
 * POST /api/agent — one agent turn, streamed as SSE. Identity comes only from the verified
 * session (rule 5). The user's message and the agent's events are stored in the thread under
 * RLS. Content is never logged (rule 9).
 */
export async function POST(request: NextRequest) {
  const me = await getPrincipal();
  if (!me || !me.tenantId || !me.role) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  if (needsMfa(me)) return NextResponse.json({ error: "Verifikasi dua langkah diperlukan." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  const { message, context, action } = parsed.data as { message: string; context: AgentContext; threadId?: string; action?: AgentAction };
  const supabase = await createClient();

  let threadId = parsed.data.threadId;
  if (threadId) {
    const { data } = await supabase.from("agent_threads").select("id").eq("id", threadId).maybeSingle();
    if (!data) threadId = undefined;
  }
  if (!threadId) {
    const berkasId = context.kind === "kantor" ? null : context.berkasId;
    const { data, error } = await supabase.from("agent_threads")
      .insert({ berkas_id: berkasId, title: message.slice(0, 80), context: { key: contextKey(context), label: context.label } })
      .select("id").single();
    if (error || !data) return NextResponse.json({ error: "Percakapan tidak dapat dibuat untuk konteks ini." }, { status: 403 });
    threadId = data.id as string;
  }
  const { data: userMsg, error: msgErr } = await supabase.from("agent_messages").insert({ thread_id: threadId, role: "user", body: message }).select("id").single();
  if (msgErr || !userMsg) return NextResponse.json({ error: "Pesan tidak dapat disimpan." }, { status: 403 });

  const provider = getAgentProvider(supabase);
  const encoder = new TextEncoder();
  const events: AgentEvent[] = [];
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of provider.run({ threadId: threadId!, userMessageId: userMsg.id as number, message, context, ...(action ? { action } : {}) })) {
          if (event.type !== "step" || event.status !== "running") events.push(event);
          controller.enqueue(encoder.encode(encodeSse(event)));
        }
      } finally {
        await supabase.from("agent_messages").insert({ thread_id: threadId, role: "agent", events });
        controller.close();
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Agent-Thread": threadId,
    },
  });
}

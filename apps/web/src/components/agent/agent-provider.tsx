"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { agentEventSchema } from "@verity/schema-ts";
import { contextKey } from "@/lib/agent/context-key";
import { createSseParser } from "@/lib/agent/sse";
import type { AgentContext, AgentEvent, CitationTarget } from "@/lib/agent/types";
import { loadThread, type StoredMessage } from "./actions";

export type UiMessage = StoredMessage & { streaming?: boolean };
type ThreadState = { threadId: string | null; messages: UiMessage[]; loaded: boolean };

type Registered = { pathname: string; context: AgentContext; suggestions: string[] };

type AgentApi = {
  open: boolean;
  embedded: boolean;
  context: AgentContext;
  suggestions: string[];
  thread: ThreadState;
  busy: boolean;
  paletteOpen: boolean;
  setOpen: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setEmbedded: (v: boolean) => void;
  register: (r: Registered | null) => void;
  send: (text: string) => Promise<void>;
  newThread: () => void;
  /** Where a citation click goes. The berkas workspace overrides it to open the document pane. */
  onCite: (target: CitationTarget) => void;
  setCiteHandler: (fn: ((t: CitationTarget) => void) | null) => void;
  activeCite: string | null;
};

const Ctx = createContext<AgentApi | null>(null);
const DEFAULT_CONTEXT: AgentContext = { kind: "kantor", label: "Seluruh kantor", page: "lainnya" };
const DEFAULT_SUGGESTIONS = ["akta menunggu TTD", "jadwal hari ini", "tenggat minggu ini", "cari Laras di klapper"];

export function useAgent() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent outside AgentProvider");
  return v;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpenState] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [threads, setThreads] = useState<Record<string, ThreadState>>({});
  const [busy, setBusy] = useState(false);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const citeHandler = useRef<((t: CitationTarget) => void) | null>(null);

  // A page's context only applies while that page is shown.
  const active = registered && registered.pathname === pathname ? registered : null;
  const context = active?.context ?? DEFAULT_CONTEXT;
  const suggestions = active?.suggestions ?? DEFAULT_SUGGESTIONS;
  const key = contextKey(context);
  const thread = threads[key] ?? { threadId: null, messages: [], loaded: false };

  useEffect(() => {
    setOpenState(window.localStorage.getItem("verity.agent.open") === "1");
  }, []);
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    window.localStorage.setItem("verity.agent.open", v ? "1" : "0");
  }, []);

  // Load the stored thread for this context once.
  useEffect(() => {
    if (threads[key]?.loaded) return;
    let cancelled = false;
    loadThread(context).then((t) => {
      if (!cancelled) setThreads((s) => (s[key]?.loaded ? s : { ...s, [key]: { ...t, loaded: true } }));
    }).catch(() => {
      if (!cancelled) setThreads((s) => ({ ...s, [key]: { threadId: null, messages: [], loaded: true } }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by context key
  }, [key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen(!open); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const patch = useCallback((k: string, fn: (t: ThreadState) => ThreadState) => {
    setThreads((s) => ({ ...s, [k]: fn(s[k] ?? { threadId: null, messages: [], loaded: true }) }));
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const k = key;
    const ctx = context;
    const tid = (threads[k]?.threadId) ?? undefined;
    setBusy(true);
    const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const agentId = -Date.now();
    patch(k, (t) => ({ ...t, messages: [...t.messages,
      { id: agentId - 1, role: "user", body: message, events: [], author: "Anda", createdAt: now },
      { id: agentId, role: "agent", body: null, events: [], author: "Agen", createdAt: now, streaming: true }] }));
    const pushEvent = (e: AgentEvent) => patch(k, (t) => ({
      ...t, messages: t.messages.map((m) => (m.id === agentId ? { ...m, events: [...m.events, e] } : m)),
    }));
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: tid, message, context: ctx }),
      });
      const newThreadId = res.headers.get("X-Agent-Thread");
      if (newThreadId) patch(k, (t) => ({ ...t, threadId: newThreadId }));
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Agen tidak dapat dihubungi." }));
        pushEvent({ type: "error", seq: 0, message: err.error ?? "Agen tidak dapat dihubungi." });
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      const feed = createSseParser((data) => {
        const parsed = agentEventSchema.safeParse(JSON.parse(data));
        if (parsed.success) pushEvent(parsed.data);
      });
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        feed(value);
      }
    } catch {
      pushEvent({ type: "error", seq: 0, message: "Koneksi terputus. Muat ulang halaman untuk melihat percakapan tersimpan." });
    } finally {
      patch(k, (t) => ({ ...t, messages: t.messages.map((m) => (m.id === agentId ? { ...m, streaming: false } : m)) }));
      setBusy(false);
    }
  }, [busy, context, key, patch, threads]);

  const newThread = useCallback(() => patch(key, () => ({ threadId: null, messages: [], loaded: true })), [key, patch]);

  const onCite = useCallback((target: CitationTarget) => {
    setActiveCite(`${target.kind}:${target.id}:${target.field ?? ""}`);
    if (citeHandler.current) citeHandler.current(target);
    else router.push(target.href);
  }, [router]);

  const api = useMemo<AgentApi>(() => ({
    open, embedded, context, suggestions, thread, busy, paletteOpen, activeCite,
    setOpen, setPaletteOpen, setEmbedded, register: setRegistered, send, newThread, onCite,
    setCiteHandler: (fn) => { citeHandler.current = fn; },
  }), [open, embedded, context, suggestions, thread, busy, paletteOpen, activeCite, setOpen, send, newThread, onCite]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** Placed on a page to tell the agent where the user is and what to suggest. */
export function AgentPageContext({ context, suggestions }: { context: AgentContext; suggestions?: string[] }) {
  const { register } = useAgent();
  const pathname = usePathname();
  const ctxJson = JSON.stringify(context);
  const sugJson = JSON.stringify(suggestions ?? []);
  useEffect(() => {
    register({ pathname, context: JSON.parse(ctxJson), suggestions: JSON.parse(sugJson) });
  }, [pathname, ctxJson, sugJson, register]);
  return null;
}

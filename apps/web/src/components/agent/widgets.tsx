"use client";

import { useState } from "react";
import { CalendarPlus, Check, ListChecks, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { AgentAction, Widget } from "@/lib/agent/types";
import { formatLongDate, jakartaToday } from "@/lib/jakarta-time";
import { SCHEDULE_KINDS, SCHEDULE_KIND_LABEL, type ScheduleKind } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { useAgent } from "./agent-provider";

type Props<K extends Widget["kind"]> = { id: string; widget: Extract<Widget, { kind: K }>; active: boolean };

/**
 * An input the agent asked for. Submitting sends the answer as the next message (with the values
 * attached as an AgentAction); the agent then prepares a proposal that still needs approval.
 * Only the latest message's widget is live; older ones are shown as answered.
 */
export function AgentWidget({ id, widget, active }: { id: string; widget: Widget; active: boolean }) {
  switch (widget.kind) {
    case "schedule_form": return <ScheduleWidget id={id} widget={widget} active={active} />;
    case "checklist_form": return <ChecklistWidget id={id} widget={widget} active={active} />;
    case "berkas_picker": return <BerkasPickerWidget id={id} widget={widget} active={active} />;
    case "checklist_batch": return <ChecklistBatchWidget id={id} widget={widget} active={active} />;
  }
}

function Frame({ icon, title, active, children }: { icon: React.ReactNode; title: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mt-3 rounded-xl border bg-card px-4 py-3.5 shadow-card", active ? "border-border" : "border-border-soft opacity-70")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13.5px] font-medium">{icon}{title}</div>
        {!active && <span className="flex items-center gap-1 text-[11.5px] text-subtle"><Check size={12} /> Sudah dilanjutkan</span>}
      </div>
      <fieldset disabled={!active} className="min-w-0">{children}</fieldset>
    </div>
  );
}

function useSubmit() {
  const { send, busy } = useAgent();
  return { busy, submit: (summary: string, action: AgentAction) => send(summary, action) };
}

function ScheduleWidget({ id, widget, active }: Props<"schedule_form">) {
  const { busy, submit } = useSubmit();
  const d = widget.defaults;
  const today = jakartaToday().date;
  const options = widget.berkas ? [widget.berkas] : widget.berkasOptions ?? [];
  const [berkasId, setBerkasId] = useState(widget.berkas?.id ?? (options.length === 1 ? options[0]!.id : ""));
  const [kind, setKind] = useState<ScheduleKind>(d.kind ?? "penandatanganan");
  const [date, setDate] = useState(d.date ?? "");
  const [time, setTime] = useState(d.time ?? "");
  const [location, setLocation] = useState(d.location ?? "");
  const chosen = options.find((o) => o.id === berkasId);
  const [title, setTitle] = useState(d.title ?? "");
  const shownTitle = title || (chosen ? `${SCHEDULE_KIND_LABEL[kind]} ${chosen.title}` : "");
  const ready = berkasId && date >= today && /^\d{2}:\d{2}$/.test(time) && shownTitle.trim().length >= 2;

  return (
    <Frame icon={<CalendarPlus size={15} className="text-muted-foreground" />} title="Isi jadwal" active={active}>
      <form className="grid grid-cols-2 gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const where = location.trim() ? `, ${location.trim()}` : "";
        void submit(`Jadwalkan ${SCHEDULE_KIND_LABEL[kind].toLowerCase()}: ${shownTitle.trim()}, ${formatLongDate(date)} ${time.replace(":", ".")} WIB${where}`, {
          kind: "schedule_form", widgetId: id, berkasId, date, time, scheduleKind: kind, title: shownTitle.trim(),
          ...(location.trim() ? { location: location.trim() } : {}),
        });
      }}>
        {!widget.berkas && (
          <div className="col-span-2">
            <Label htmlFor={`${id}-berkas`}>Berkas</Label>
            <Select id={`${id}-berkas`} value={berkasId} onChange={(e) => setBerkasId(e.target.value)} required>
              <option value="" disabled>Pilih berkas…</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </div>
        )}
        <div>
          <Label htmlFor={`${id}-date`}>Tanggal</Label>
          <Input id={`${id}-date`} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor={`${id}-time`}>Jam (WIB)</Label>
          <Input id={`${id}-time`} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor={`${id}-kind`}>Jenis</Label>
          <Select id={`${id}-kind`} value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)}>
            {SCHEDULE_KINDS.map((k) => <option key={k} value={k}>{SCHEDULE_KIND_LABEL[k]}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-loc`}>Tempat</Label>
          <Input id={`${id}-loc`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ruang Utama" maxLength={200} />
        </div>
        <div className="col-span-2">
          <Label htmlFor={`${id}-title`}>Judul</Label>
          <Input id={`${id}-title`} value={shownTitle} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3">
          <p className="text-[11.5px] text-subtle">Menjadi usulan jadwal yang perlu disetujui.</p>
          <Button type="submit" variant="ink" disabled={!ready || busy}>Siapkan usulan</Button>
        </div>
      </form>
    </Frame>
  );
}

function ChecklistWidget({ id, widget, active }: Props<"checklist_form">) {
  const { busy, submit } = useSubmit();
  const [title, setTitle] = useState(widget.defaults.title ?? "");
  const [due, setDue] = useState(widget.defaults.dueDate ?? "");
  const today = jakartaToday().date;
  const ready = title.trim().length >= 2;
  return (
    <Frame icon={<ListChecks size={15} className="text-muted-foreground" />} title={`Checklist ${widget.berkas.title}`} active={active}>
      <form className="grid grid-cols-[1fr_150px] gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        void submit(`Tambahkan checklist: ${title.trim()}${due ? `, tenggat ${formatDate(due)}` : ""}`, {
          kind: "checklist_form", widgetId: id, berkasId: widget.berkas.id, title: title.trim(), ...(due ? { dueDate: due } : {}),
        });
      }}>
        <div>
          <Label htmlFor={`${id}-title`}>Item</Label>
          <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Minta NPWP Laras" maxLength={200} required />
        </div>
        <div>
          <Label htmlFor={`${id}-due`}>Tenggat</Label>
          <Input id={`${id}-due`} type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button type="submit" variant="ink" disabled={!ready || busy}>Siapkan usulan</Button>
        </div>
      </form>
    </Frame>
  );
}

const THEN_LABEL = { schedule: "dijadwalkan", summary: "diringkas", kelengkapan: "diperiksa kelengkapannya", readiness: "diperiksa kesiapannya" } as const;

function BerkasPickerWidget({ id, widget, active }: Props<"berkas_picker">) {
  const { busy, submit } = useSubmit();
  return (
    <Frame icon={<FolderOpen size={15} className="text-muted-foreground" />} title={`Berkas mana yang ${THEN_LABEL[widget.then]}?`} active={active}>
      <div className="flex flex-col gap-1.5">
        {widget.options.map((o) => (
          <button key={o.id} type="button" disabled={busy}
            onClick={() => void submit(`Berkas ${o.title}`, { kind: "berkas_picker", widgetId: id, berkasId: o.id, then: widget.then, text: widget.text })}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-[13px] hover:bg-muted disabled:opacity-60">
            <span className="min-w-0 truncate">{o.title}</span>
            {o.sub && <span className="shrink-0 text-[12px] text-subtle">{o.sub}</span>}
          </button>
        ))}
      </div>
    </Frame>
  );
}

function ChecklistBatchWidget({ id, widget, active }: Props<"checklist_batch">) {
  const { busy, submit } = useSubmit();
  const [picked, setPicked] = useState(() => new Set(widget.items.map((i) => i.title)));
  const chosen = widget.items.filter((i) => picked.has(i.title));
  return (
    <Frame icon={<ListChecks size={15} className="text-muted-foreground" />} title="Jadikan checklist" active={active}>
      <ul className="space-y-1">
        {widget.items.map((i) => (
          <li key={i.title}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-muted">
              <input type="checkbox" className="mt-0.5 size-4 accent-foreground" checked={picked.has(i.title)}
                onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(i.title); else n.delete(i.title); return n; })} />
              <span className="min-w-0 flex-1">
                {i.title}
                <span className="block text-[11.5px] text-subtle">{[i.reason, i.dueDate && `tenggat ${formatDate(i.dueDate)}`].filter(Boolean).join(" · ")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-subtle">Menjadi satu usulan yang perlu disetujui.</p>
        <Button type="button" variant="ink" disabled={!chosen.length || busy}
          onClick={() => void submit(`Jadikan checklist: ${chosen.map((i) => i.title).join("; ")}`, {
            kind: "checklist_batch", widgetId: id, berkasId: widget.berkas.id,
            items: chosen.map((i) => ({ title: i.title, ...(i.dueDate ? { dueDate: i.dueDate } : {}) })),
          })}>
          Buat usulan ({chosen.length})
        </Button>
      </div>
    </Frame>
  );
}

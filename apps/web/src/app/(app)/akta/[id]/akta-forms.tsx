"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogActions, DialogButton, useCloseDialog, useCloseOnOk } from "@/components/ui/dialog";
import { FormError, Textarea } from "@/components/ui/blocks";
import { Input, Label, Select } from "@/components/ui/input";
import { COMPANY_FORMS, PARTY_ROLES, PARTY_ROLE_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import {
  addExistingParty, addNewCompany, addNewPerson, finalizeAkta, transitionAkta, updateAkta, type FormState,
} from "../actions";

export function TransitionButton({ aktaId, to, label, variant = "default", disabledReason }: {
  aktaId: string; to: string; label: string; variant?: "default" | "primary" | "ink"; disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(transitionAkta, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="aktaId" value={aktaId} />
      <input type="hidden" name="to" value={to} />
      <Button type="submit" variant={variant} disabled={pending || !!disabledReason} title={disabledReason}>
        {pending ? "Memproses…" : label}
      </Button>
      {disabledReason && <p className="text-[11.5px] text-subtle">{disabledReason}</p>}
      <FormError message={state.error} />
    </form>
  );
}

export function FinalizeForm({ aktaId, today, disabledReason }: { aktaId: string; today: string; disabledReason?: string }) {
  return (
    <div className="space-y-1">
      <DialogButton variant="primary" label="Finalkan dan beri nomor" title="Finalkan akta" disabled={!!disabledReason}>
        <FinalizeBody aktaId={aktaId} today={today} />
      </DialogButton>
      {disabledReason && <p className="text-[11.5px] text-subtle">{disabledReason}</p>}
    </div>
  );
}

function FinalizeBody({ aktaId, today }: { aktaId: string; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(finalizeAkta, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="aktaId" value={aktaId} />
      <p className="text-[12.5px] text-muted-foreground">
        Nomor akta diberikan sekarang, berurutan, dan tidak dapat diubah atau dipakai ulang. Repertorium dan buku klapper
        terisi otomatis. Lakukan setelah akta ditandatangani.
      </p>
      <div className="max-w-48">
        <Label htmlFor="aktaDate">Tanggal akta</Label>
        <Input id="aktaDate" name="aktaDate" type="date" defaultValue={today} max={today} required />
      </div>
      <label className="flex items-start gap-2 text-[12.5px]">
        <input type="checkbox" name="confirm" className="mt-0.5 accent-[var(--primary)]" />
        Saya memastikan akta ini sudah ditandatangani dan datanya benar.
      </label>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Memfinalkan…" : "Finalkan akta"}</Button>
      </DialogActions>
    </form>
  );
}

export function EditAktaForm(props: { aktaId: string; title: string; notes: string | null }) {
  return (
    <DialogButton buttonSize="sm" icon={<Pencil size={13} />} label="Ubah" title="Ubah informasi akta">
      <EditBody {...props} />
    </DialogButton>
  );
}

function EditBody({ aktaId, title, notes }: { aktaId: string; title: string; notes: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateAkta, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="aktaId" value={aktaId} />
      <div>
        <Label htmlFor="title">Judul akta</Label>
        <Input id="title" name="title" defaultValue={title} required />
      </div>
      <div>
        <Label htmlFor="notes">Keterangan</Label>
        <Textarea id="notes" name="notes" defaultValue={notes ?? ""} />
      </div>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
      </DialogActions>
    </form>
  );
}

type Subject = { value: string; label: string };

function RoleSelect({ id }: { id: string }) {
  return (
    <Select id={id} name="role" defaultValue="penghadap">
      {PARTY_ROLES.map((r) => <option key={r} value={r}>{PARTY_ROLE_LABEL[r]}</option>)}
    </Select>
  );
}

export function AddPartyForms(props: { aktaId: string; subjects: Subject[] }) {
  return (
    <DialogButton variant="ink" icon={<Plus size={14} />} label="Tambah pihak" title="Tambah pihak akta" size="lg"
      description="Pilih orang atau badan usaha yang sudah ada, atau buat data baru.">
      <PartyBody {...props} />
    </DialogButton>
  );
}

function PartyBody({ aktaId, subjects }: { aktaId: string; subjects: Subject[] }) {
  const [tab, setTab] = useState<"existing" | "person" | "company">(subjects.length ? "existing" : "person");
  const [existing, existingAction, p1] = useActionState<FormState, FormData>(addExistingParty, {});
  const [person, personAction, p2] = useActionState<FormState, FormData>(addNewPerson, {});
  const [company, companyAction, p3] = useActionState<FormState, FormData>(addNewCompany, {});
  const close = useCloseDialog();
  useEffect(() => { if (existing.ok || person.ok || company.ok) close(); }, [existing, person, company, close]);
  const tabs = [
    ["existing", "Dari data yang ada"],
    ["person", "Orang baru"],
    ["company", "Badan usaha baru"],
  ] as const;

  return (
    <div className="space-y-3">
      <div role="tablist" className="flex gap-4 border-b border-border-soft">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px border-b-2 border-transparent pb-2 text-[12.5px] text-muted-foreground", tab === id && "border-foreground font-medium text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "existing" && (
        <form action={existingAction} className="grid grid-cols-[1fr_160px_auto] items-end gap-2">
          <input type="hidden" name="aktaId" value={aktaId} />
          <div>
            <Label htmlFor="subject">Orang / badan usaha</Label>
            <Select id="subject" name="subject" defaultValue="" required>
              <option value="" disabled>{subjects.length ? "Pilih" : "Belum ada data"}</option>
              {subjects.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="role-existing">Kedudukan</Label>
            <RoleSelect id="role-existing" />
          </div>
          <Button type="submit" variant="ink" disabled={p1}>Tambahkan</Button>
          <div className="col-span-3"><FormError message={existing.error} /></div>
        </form>
      )}

      {tab === "person" && (
        <form action={personAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="aktaId" value={aktaId} />
          <div className="col-span-2">
            <Label htmlFor="fullName">Nama lengkap (sesuai KTP)</Label>
            <Input id="fullName" name="fullName" required />
          </div>
          <div>
            <Label htmlFor="nik">NIK</Label>
            <Input id="nik" name="nik" inputMode="numeric" maxLength={16} pattern="[0-9]{16}" className="tabular-nums" />
          </div>
          <div>
            <Label htmlFor="role-person">Kedudukan</Label>
            <RoleSelect id="role-person" />
          </div>
          <div>
            <Label htmlFor="birthPlace">Tempat lahir</Label>
            <Input id="birthPlace" name="birthPlace" />
          </div>
          <div>
            <Label htmlFor="birthDate">Tanggal lahir</Label>
            <Input id="birthDate" name="birthDate" type="date" />
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Alamat</Label>
            <Input id="address" name="address" />
          </div>
          <div>
            <Label htmlFor="occupation">Pekerjaan</Label>
            <Input id="occupation" name="occupation" />
          </div>
          <div className="col-span-2 space-y-2">
            <FormError message={person.error} />
            <Button type="submit" variant="ink" disabled={p2}>Simpan dan tambahkan</Button>
          </div>
        </form>
      )}

      {tab === "company" && (
        <form action={companyAction} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="aktaId" value={aktaId} />
          <div>
            <Label htmlFor="legalForm">Bentuk</Label>
            <Select id="legalForm" name="legalForm" defaultValue="PT">
              {COMPANY_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="name">Nama</Label>
            <Input id="name" name="name" required />
          </div>
          <div>
            <Label htmlFor="nib">NIB</Label>
            <Input id="nib" name="nib" inputMode="numeric" maxLength={13} pattern="[0-9]{13}" className="tabular-nums" />
          </div>
          <div>
            <Label htmlFor="role-company">Kedudukan</Label>
            <RoleSelect id="role-company" />
          </div>
          <div>
            <Label htmlFor="domicile">Kedudukan hukum (kota)</Label>
            <Input id="domicile" name="domicile" />
          </div>
          <div>
            <Label htmlFor="capacity">Diwakili oleh / selaku</Label>
            <Input id="capacity" name="capacity" placeholder="Direktur Utama" />
          </div>
          <div className="col-span-2 space-y-2">
            <FormError message={company.error} />
            <Button type="submit" variant="ink" disabled={p3}>Simpan dan tambahkan</Button>
          </div>
        </form>
      )}
    </div>
  );
}

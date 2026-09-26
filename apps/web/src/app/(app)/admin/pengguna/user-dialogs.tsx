"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/blocks";
import { DialogActions, DialogButton, useCloseDialog, useCloseOnOk } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { APP_ROLES, ROLE_LABEL, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { addMember, type FormState } from "./actions";
import { createAccount, updateMember, type AccountState } from "./account-actions";

/** 14 characters from an unambiguous alphabet, generated in the browser (never stored). */
function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function RoleSelect({ id, defaultValue = "staf_admin" }: { id: string; defaultValue?: AppRole }) {
  return (
    <Select id={id} name="role" defaultValue={defaultValue}>
      {APP_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </Select>
  );
}

export function AddUserDialog() {
  return (
    <DialogButton variant="ink" icon={<UserPlus size={14} />} label="Tambah pengguna" title="Tambah pengguna ke kantor"
      description="Setiap perubahan dicatat di audit log dan diberitahukan kepada Notaris.">
      <AddUserBody />
    </DialogButton>
  );
}

function AddUserBody() {
  const [tab, setTab] = useState<"baru" | "ada">("baru");
  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg bg-muted p-0.5 text-[13px]">
        {([["baru", "Akun baru"], ["ada", "Akun yang sudah ada"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cn("rounded-md px-3 py-1.5 text-muted-foreground", tab === id && "bg-card font-medium text-foreground shadow-card")}>
            {label}
          </button>
        ))}
      </div>
      {tab === "baru" ? <NewAccountForm /> : <ExistingAccountForm />}
    </div>
  );
}

function NewAccountForm() {
  const [state, action, pending] = useActionState<AccountState, FormData>(createAccount, {});
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const close = useCloseDialog();
  if (state.ok) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl bg-success-soft px-4 py-3 text-[13px] text-success">
          <Check size={16} className="mt-0.5 shrink-0" /> <p>{state.ok}</p>
        </div>
        <div>
          <Label>Kata sandi awal (tampil sekali ini saja)</Label>
          <div className="flex gap-2">
            <Input readOnly value={password} className="font-mono tracking-wide" />
            <Button type="button" onClick={async () => { await navigator.clipboard.writeText(password); setCopied(true); }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Disalin" : "Salin"}
            </Button>
          </div>
        </div>
        <div className="flex justify-end border-t border-border-soft pt-4">
          <Button type="button" variant="ink" onClick={close}>Selesai</Button>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label htmlFor="n-email">Email</Label>
        <Input id="n-email" name="email" type="email" autoComplete="off" required autoFocus />
      </div>
      <div>
        <Label htmlFor="n-name">Nama tampilan</Label>
        <Input id="n-name" name="displayName" required />
      </div>
      <div>
        <Label htmlFor="n-role">Peran</Label>
        <RoleSelect id="n-role" />
      </div>
      <div className="col-span-2">
        <Label htmlFor="n-pass">Kata sandi awal</Label>
        <div className="flex gap-2">
          <Input id="n-pass" name="password" type="text" autoComplete="new-password" minLength={10} maxLength={72} required
            value={password} onChange={(e) => setPassword(e.target.value)} className="font-mono tracking-wide" spellCheck={false} />
          <Button type="button" onClick={() => setPassword(generatePassword())}><KeyRound size={14} /> Buat acak</Button>
        </div>
        <p className="mt-1.5 text-[12px] text-subtle">
          Minimal 10 karakter. Pengguna wajib menggantinya saat pertama masuk. Verifikasi dua langkah bisa dipasang sendiri dari halaman Keamanan (disarankan untuk Notaris).
        </p>
      </div>
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>{pending ? "Membuat akun…" : "Buat akun"}</Button>
        </DialogActions>
      </div>
    </form>
  );
}

function ExistingAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addMember, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <p className="col-span-2 text-[12.5px] text-muted-foreground">Untuk akun login yang sudah dibuat (misalnya lewat skrip admin), beri peran di kantor ini.</p>
      <div className="col-span-2">
        <Label htmlFor="e-email">Email akun</Label>
        <Input id="e-email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="e-name">Nama tampilan</Label>
        <Input id="e-name" name="displayName" required />
      </div>
      <div>
        <Label htmlFor="e-role">Peran</Label>
        <RoleSelect id="e-role" />
      </div>
      <div className="col-span-full">
        <FormError message={state.error} />
        <DialogActions>
          <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Tambahkan"}</Button>
        </DialogActions>
      </div>
    </form>
  );
}

export function EditMemberDialog({ member }: { member: { userId: string; name: string; email: string; role: AppRole; active: boolean } }) {
  return (
    <DialogButton variant="ghost" buttonSize="sm" icon={<Pencil size={13} />} label="Ubah" title={`Ubah ${member.name}`} description={member.email} size="sm">
      <EditBody member={member} />
    </DialogButton>
  );
}

function EditBody({ member }: { member: { userId: string; name: string; role: AppRole; active: boolean } }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateMember, {});
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={member.userId} />
      <div>
        <Label htmlFor="m-name">Nama tampilan</Label>
        <Input id="m-name" name="displayName" defaultValue={member.name} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="m-role">Peran</Label>
          <RoleSelect id="m-role" defaultValue={member.role} />
        </div>
        <div>
          <Label htmlFor="m-active">Status</Label>
          <Select id="m-active" name="active" defaultValue={String(member.active)}>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </Select>
        </div>
      </div>
      <p className="text-[12px] text-subtle">Pengguna tidak dihapus; menonaktifkan menjaga jejak audit tetap utuh.</p>
      <FormError message={state.error} />
      <DialogActions>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
      </DialogActions>
    </form>
  );
}

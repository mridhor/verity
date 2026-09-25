"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type Size = "sm" | "md" | "lg";
const WIDTH: Record<Size, string> = { sm: "w-[min(92vw,420px)]", md: "w-[min(92vw,540px)]", lg: "w-[min(94vw,760px)]" };

/**
 * Centered modal on the native <dialog> (showModal): focus trap, Esc, inert background and
 * top layer come from the browser. Focus returns to the element that opened it.
 */
export function Dialog({ open, onClose, title, description, size = "md", children }: {
  open: boolean; onClose: () => void; title: string; description?: React.ReactNode; size?: Size; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      opener.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onNativeClose = () => {
      onClose();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
    el.addEventListener("close", onNativeClose);
    return () => el.removeEventListener("close", onNativeClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onMouseDown={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className={cn(
        "dialog-pop fixed inset-0 m-auto h-fit max-h-[88vh] overflow-hidden rounded-[10px] border border-border bg-card p-0 text-foreground",
        "shadow-[0_24px_60px_-24px_rgba(40,36,20,.45)] backdrop:bg-foreground/25",
        WIDTH[size],
      )}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-start gap-3 border-b border-border-soft px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 id="dialog-title" className="text-[15px] font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{description}</p>}
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Tutup"
              className="-mr-1 rounded-md p-1 text-subtle hover:bg-border-soft hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

const CloseCtx = createContext<() => void>(() => {});
/** Closes the surrounding dialog; forms call it after a successful save. */
export const useCloseDialog = () => useContext(CloseCtx);

/** A button that opens a dialog with the given content. */
export function DialogButton({ label, icon, title, description, size, variant = "default", buttonSize, className, disabled, children }: {
  label: React.ReactNode; icon?: React.ReactNode; title: string; description?: React.ReactNode; size?: Size;
  variant?: React.ComponentProps<typeof Button>["variant"]; buttonSize?: React.ComponentProps<typeof Button>["size"];
  className?: string; disabled?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant={variant} size={buttonSize} className={className} disabled={disabled} onClick={() => setOpen(true)}>
        {icon}{label}
      </Button>
      <Dialog open={open} onClose={close} title={title} description={description} size={size}>
        <CloseCtx.Provider value={close}>{children}</CloseCtx.Provider>
      </Dialog>
    </>
  );
}

/** Closes the dialog once a server action reports success. */
export function useCloseOnOk(state: { ok?: string | boolean } | undefined) {
  const close = useCloseDialog();
  useEffect(() => { if (state?.ok) close(); }, [state, close]);
}

/** Footer row for forms inside a dialog: cancel on the left of the main action. */
export function DialogActions({ children }: { children: React.ReactNode }) {
  const close = useCloseDialog();
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-border-soft pt-4">
      <Button type="button" variant="ghost" onClick={close}>Batal</Button>
      {children}
    </div>
  );
}

/**
 * A button that asks for confirmation in a centered dialog before running a server action
 * (delete draft, revoke sessions…). `fields` become hidden inputs.
 */
export function ConfirmAction({ label, title, description, confirmLabel, action, fields, variant = "danger", buttonSize, confirmVariant = "danger" }: {
  label: React.ReactNode; title: string; description: React.ReactNode; confirmLabel: string;
  action: (form: FormData) => void | Promise<void>; fields: Record<string, string>;
  variant?: React.ComponentProps<typeof Button>["variant"]; buttonSize?: React.ComponentProps<typeof Button>["size"];
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <DialogButton label={label} title={title} size="sm" variant={variant} buttonSize={buttonSize}>
      <ConfirmBody description={description} confirmLabel={confirmLabel} action={action} fields={fields} confirmVariant={confirmVariant} />
    </DialogButton>
  );
}

function ConfirmBody({ description, confirmLabel, action, fields, confirmVariant }: {
  description: React.ReactNode; confirmLabel: string; action: (form: FormData) => void | Promise<void>;
  fields: Record<string, string>; confirmVariant: React.ComponentProps<typeof Button>["variant"];
}) {
  const close = useCloseDialog();
  const [pending, setPending] = useState(false);
  return (
    <form action={async (fd) => { setPending(true); try { await action(fd); } finally { setPending(false); close(); } }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="text-[13px] text-muted-foreground">{description}</div>
      <DialogActions>
        <Button type="submit" variant={confirmVariant} disabled={pending} autoFocus>{pending ? "Memproses…" : confirmLabel}</Button>
      </DialogActions>
    </form>
  );
}

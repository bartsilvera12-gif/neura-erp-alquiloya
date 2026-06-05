/**
 * Singleton-based dialog API: reemplaza window.confirm / window.alert con
 * modales lindos sin requerir hooks ni context en cada callsite.
 *
 * Uso:
 *   import { confirmDialog, notify } from "@/lib/ui/dialogs";
 *   if (!(await confirmDialog({ title: "...", message: "..." }))) return;
 *   notify({ tone: "success", message: "Listo" });
 *
 * El componente <UiDialogsRoot /> (mounteado en RootLayout) escucha eventos
 * y renderiza el UI.
 */

export type DialogTone = "neutral" | "success" | "warning" | "danger";

export type ConfirmDialogOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
};

export type NotifyOptions = {
  tone?: DialogTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type ConfirmRequest = ConfirmDialogOptions & {
  __resolve: (v: boolean) => void;
};

type DialogListener = {
  onConfirm: (req: ConfirmRequest) => void;
  onNotify: (req: NotifyOptions) => void;
};

let listener: DialogListener | null = null;
const pendingConfirms: ConfirmRequest[] = [];
const pendingNotifies: NotifyOptions[] = [];

/** Lo llama UiDialogsRoot al montar. Drena lo pendiente. */
export function __registerDialogListener(l: DialogListener): () => void {
  listener = l;
  while (pendingConfirms.length) l.onConfirm(pendingConfirms.shift()!);
  while (pendingNotifies.length) l.onNotify(pendingNotifies.shift()!);
  return () => {
    if (listener === l) listener = null;
  };
}

/** Reemplazo async de window.confirm. */
export function confirmDialog(opts: ConfirmDialogOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const req: ConfirmRequest = { ...opts, __resolve: resolve };
    if (listener) listener.onConfirm(req);
    else pendingConfirms.push(req);
  });
}

/** Notificacion tipo toast (reemplaza window.alert para "ok" simples). */
export function notify(opts: NotifyOptions): void {
  if (listener) listener.onNotify(opts);
  else pendingNotifies.push(opts);
}

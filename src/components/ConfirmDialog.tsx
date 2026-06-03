"use client";

import { useEffect } from "react";

type Tone = "danger" | "default";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmCls =
    tone === "danger"
      ? "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500/30"
      : "bg-[#4FAEB2] text-white hover:bg-[#3F8E91] focus:ring-[#4FAEB2]/30";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <h3 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        {description ? (
          <div className="mt-2 text-sm leading-relaxed text-slate-600">{description}</div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 disabled:cursor-wait disabled:opacity-60 ${confirmCls}`}
          >
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

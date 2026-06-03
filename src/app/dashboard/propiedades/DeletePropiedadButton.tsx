"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function DeletePropiedadButton({ id, titulo }: { id: string; titulo: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onConfirm() {
    setBusy(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-propiedades/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      window.alert(`No se pudo eliminar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setBusy(false);
    }
  }

  const label = titulo?.trim() || "esta propiedad";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        title="Eliminar"
        aria-label="Eliminar"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
      <ConfirmDialog
        open={open}
        title="Eliminar propiedad"
        description={
          <>
            Vas a eliminar <strong className="text-slate-900">{label}</strong>.
            <br />
            Se borrarán también sus fotos y características.
            <br />
            <span className="text-rose-600">Esta acción no se puede deshacer.</span>
          </>
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        busy={busy}
        onConfirm={onConfirm}
        onCancel={() => !busy && setOpen(false)}
      />
    </>
  );
}

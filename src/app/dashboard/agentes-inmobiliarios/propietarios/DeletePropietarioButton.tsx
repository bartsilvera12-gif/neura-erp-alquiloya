"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export default function DeletePropietarioButton({
  id,
  nombre,
}: {
  id: string;
  nombre: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDelete() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propietarios/${id}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
        className="rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
        title="Borrar propietario"
      >
        Borrar
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              Borrar propietario
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Vas a borrar a <strong>{nombre}</strong>. Si tiene cuenta de portal,
              también se elimina su acceso. Esta acción no se puede deshacer.
            </p>
            <p className="mt-2 text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Si el propietario tiene propiedades cargadas, no se podrá borrar
              hasta que las traslades o elimines.
            </p>
            {err ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {err}
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleDelete}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? "Borrando…" : "Borrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export default function DeletePropiedadButton({ id, titulo }: { id: string; titulo: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const label = titulo?.trim() || "esta propiedad";
    const ok = window.confirm(
      `¿Eliminar "${label}"?\n\nSe borrarán también sus fotos y características.\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/dashboard/alquiloya-propiedades/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      window.alert(`No se pudo eliminar: ${e instanceof Error ? e.message : "error"}`);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Eliminando…" : "Eliminar"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { notify } from "@/lib/ui/dialogs";

/**
 * Toggle "Activo" del listado de propiedades del ERP.
 *
 * IMPORTANTE: el catalogo publico filtra por (activo=true AND visible_web=true).
 * Antes este boton solo tocaba `activo` y dejaba `visible_web` como estuviera,
 * asi que se podia tener una propiedad "activa" en el ERP pero invisible en la
 * web. Ahora sincroniza los dos flags juntos:
 *   - Click en "No" -> Sí: activo=true + visible_web=true (publica + visible)
 *   - Click en "Sí" -> No: activo=false + visible_web=false (pausa total)
 *
 * Si el admin necesita el matiz (pausada pero visible en historial, etc.)
 * puede editar la propiedad y ajustar campos avanzados desde el detalle.
 */
export default function ToggleActivoButton({
  id,
  initial,
  visibleWebInitial,
  titulo,
}: {
  id: string;
  initial: boolean;
  visibleWebInitial?: boolean;
  titulo: string | null;
}) {
  const router = useRouter();
  // Mostramos "Sí" solo cuando AMBOS flags estan ON. Esto destapa los casos
  // raros (activo=true + visible_web=false) que confunden al admin.
  const startedOn = !!initial && visibleWebInitial !== false;
  const [on, setOn] = useState(startedOn);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    setErr(null);
    const prev = on;
    setOn(next);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-propiedades/${id}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Sincronizamos los DOS flags: la propiedad esta "activa" si y solo
          // si el visitante anonimo la puede ver en el catalogo publico.
          body: JSON.stringify({ activo: next, visible_web: next }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setOn(prev);
      const msg = e instanceof Error ? e.message : "Error";
      setErr(msg);
      notify({
        tone: "danger",
        title: `No se pudo ${next ? "publicar" : "pausar"}`,
        message: `${titulo ?? "esta propiedad"}: ${msg}`,
      });
    } finally {
      setBusy(false);
    }
  }

  const label = on ? "Sí" : "No";
  const cls = on
    ? "bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200 hover:bg-slate-200";
  const tooltip = on
    ? "Visible en la web pública. Clic para pausar."
    : "Pausada (no aparece en el catálogo público). Clic para publicar.";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={tooltip}
      aria-label={tooltip}
      aria-pressed={on}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 transition-colors disabled:cursor-wait disabled:opacity-60 ${cls}`}
    >
      {busy ? "…" : label}
      {err ? <span className="sr-only">{err}</span> : null}
    </button>
  );
}

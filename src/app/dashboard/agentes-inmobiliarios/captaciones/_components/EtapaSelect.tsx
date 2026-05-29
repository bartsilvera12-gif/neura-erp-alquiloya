"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

export type Etapa = "nuevo" | "contacto" | "negocio_activo" | "cerrado" | "rechazado";

export const ETAPA_LABELS: Record<Etapa, string> = {
  nuevo: "Nuevo",
  contacto: "Contacto",
  negocio_activo: "Negocio activo",
  cerrado: "Cerrado",
  rechazado: "Rechazado",
};

const ETAPA_COLORS: Record<Etapa, string> = {
  nuevo: "bg-sky-100 text-sky-800 ring-sky-200",
  contacto: "bg-amber-100 text-amber-800 ring-amber-200",
  negocio_activo: "bg-violet-100 text-violet-800 ring-violet-200",
  cerrado: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  rechazado: "bg-rose-100 text-rose-800 ring-rose-200",
};

const ALL_ETAPAS: Etapa[] = ["nuevo", "contacto", "negocio_activo", "cerrado", "rechazado"];

export function EtapaBadge({ etapa }: { etapa: string }) {
  const e = (etapa as Etapa) || "nuevo";
  const cls = ETAPA_COLORS[e] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ${cls}`}>
      {ETAPA_LABELS[e] ?? e}
    </span>
  );
}

export function EtapaSelect({
  captacionId,
  initial,
}: {
  captacionId: string;
  initial: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<Etapa>((initial as Etapa) || "nuevo");
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function change(next: Etapa) {
    if (next === value) return;
    setErr(null);
    const prev = value;
    setValue(next); // optimista
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-captaciones/${captacionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etapa: next }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setValue(prev);
        setErr(data.error ?? `HTTP ${res.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setValue(prev);
      setErr(e instanceof Error ? e.message : "Error");
    }
  }

  const baseCls =
    "rounded-md border px-2 py-1 text-xs font-semibold ring-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/40 disabled:opacity-60";
  const colorCls = ETAPA_COLORS[value] ?? "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value as Etapa)}
        className={`${baseCls} ${colorCls} border-transparent`}
      >
        {ALL_ETAPAS.map((e) => (
          <option key={e} value={e}>
            {ETAPA_LABELS[e]}
          </option>
        ))}
      </select>
      {err ? <span className="text-[10px] text-rose-600">{err}</span> : null}
    </div>
  );
}

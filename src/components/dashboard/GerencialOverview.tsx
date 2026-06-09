"use client";

import { useEffect, useState } from "react";
import { cachedSessionFetch } from "@/lib/api/cached-session-fetch";
// AccesosRapidos: el cliente pidio que el dashboard sea solo informacion,
// sin botones para "Nueva propiedad / Nuevo agente / Nuevo propietario /
// Solicitudes / Captaciones / Resenias". Mantengo el archivo y el componente
// definido por si se quiere reactivar mas adelante.
// import AccesosRapidos from "./AccesosRapidos";
import AlertasStrip from "./AlertasStrip";
import PulsoDelDia from "./PulsoDelDia";
import ActividadReciente from "./ActividadReciente";

export type ModulosDisponibles = {
  propiedades: boolean;
  agentes: boolean;
  propietarios: boolean;
  solicitudes_acceso: boolean;
  solicitudes_servicio: boolean;
  agente_resenas: boolean;
  agente_captaciones: boolean;
  consultas_propiedad: boolean;
  facturas: boolean;
  pagos: boolean;
  productos: boolean;
};

export type Alerta = {
  key: string;
  label: string;
  count: number;
  severity: "danger" | "warning" | "info";
  href: string;
};

export type Kpi = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  delta?: { value: number; sign: "up" | "down" | "flat"; suffix: string };
  href?: string;
};

export type ActividadItem = {
  key: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  cuando: string;
  href?: string;
};

type Overview = {
  modulos: ModulosDisponibles;
  alertas: Alerta[];
  kpis: Kpi[];
  actividad: ActividadItem[];
};

function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}
function fechaLarga(): string {
  try {
    return new Intl.DateTimeFormat("es-PY", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export default function GerencialOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        // Cacheado 60s — KPIs no real-time, evita el spike de 4s al cambiar de pestaña.
        const body = await cachedSessionFetch<{
          success?: boolean;
          data?: Overview;
          error?: string;
        }>("/api/dashboard/overview", 60 * 1000);
        if (cancelled) return;
        if (body.success && body.data) setData(body.data);
        else throw new Error(body.error ?? "Respuesta inválida");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-6 space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  // Si hubo error: degradamos en silencio (el dashboard original sigue funcionando).
  if (err || !data) return null;

  const tieneAlgo =
    data.alertas.length > 0 ||
    data.kpis.length > 0 ||
    data.actividad.length > 0;

  if (!tieneAlgo) return null;

  return (
    <section className="mb-8 space-y-5">
      {/* Header: saludo + fecha (solo informacion — accesos rapidos removidos
          a pedido del cliente). */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-[#4FAEB2]/5 px-5 py-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3F8E91]">
          Centro de control
        </p>
        <h2 className="mt-0.5 text-xl font-semibold text-slate-900">
          {saludo()} ·{" "}
          <span className="font-normal text-slate-500">{fechaLarga()}</span>
        </h2>
      </header>

      {/* Stripe de alertas (solo si hay alertas con count > 0) */}
      {data.alertas.length > 0 ? <AlertasStrip alertas={data.alertas} /> : null}

      {/* KPIs pulso del día */}
      {data.kpis.length > 0 ? <PulsoDelDia kpis={data.kpis} /> : null}

      {/* Actividad reciente */}
      {data.actividad.length > 0 ? <ActividadReciente items={data.actividad} /> : null}
    </section>
  );
}

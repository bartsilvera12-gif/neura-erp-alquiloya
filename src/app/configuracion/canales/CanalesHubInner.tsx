"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChannelBadge, channelTypeLabel } from "@/components/chat/ChannelBadge";
import { OmnichannelChannelCard } from "@/components/chat/OmnichannelChannelCard";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { normalizeChannelType } from "@/lib/chat/channel-type-utils";
import { fetchChatChannels, type ChatChannelRow } from "@/lib/chat/actions";
import { OMNICHANNEL_CARD_DEFINITIONS } from "@/lib/chat/omnichannel-catalog";

function hasOmnichannelFromModuleAccess(body: {
  superAdmin?: boolean;
  slugs?: string[];
}): boolean {
  if (body.superAdmin) return true;
  const slugs = Array.isArray(body.slugs) ? body.slugs : [];
  return slugs.includes("conversaciones") || slugs.includes("omnicanal");
}

export function CanalesHubInner() {
  const searchParams = useSearchParams();
  const tipoFiltro = (searchParams?.get("tipo") ?? "").trim().toLowerCase();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<ChatChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchChatChannels();
      setRows(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar canales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWithSupabaseSession("/api/empresas/module-access", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        try {
          const body = (await res.json()) as { superAdmin?: boolean; slugs?: unknown };
          const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s): s is string => typeof s === "string") : [];
          setAllowed(hasOmnichannelFromModuleAccess({ superAdmin: body.superAdmin, slugs }));
        } catch {
          setAllowed(false);
        }
      })
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const filteredRows = useMemo(() => {
    if (!tipoFiltro) return [];
    return rows.filter((r) => normalizeChannelType(r.type) === tipoFiltro);
  }, [rows, tipoFiltro]);

  if (allowed === null) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400">Cargando…</div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-medium">Módulo no habilitado</p>
        <p className="mt-2 text-amber-800/90">
          Tu empresa no tiene el módulo de conversaciones u omnicanal. Contactá al administrador.
        </p>
        <Link href="/configuracion" className="mt-4 inline-block text-sm font-semibold text-amber-900 underline">
          Volver a configuración
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/configuracion" className="hover:text-slate-800">
              Configuración
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Canales y comunicación</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Canales y comunicación</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Omnicanal: gestioná WhatsApp, redes sociales y email desde una misma arquitectura. Los canales sin
            integración completa ya podés dejarlos preparados con credenciales base.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Link
            href="/configuracion/colas"
            className="inline-flex items-center justify-center shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Colas y enrutamiento
          </Link>
          <Link
            href="/configuracion/canales/nuevo?tipo=whatsapp"
            className="inline-flex items-center justify-center shrink-0 rounded-xl bg-[#0EA5E9] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0284C7] transition-colors"
          >
            Conectar canal
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
          {OMNICHANNEL_CARD_DEFINITIONS.map((def) => (
            <li key={def.type}>
              <OmnichannelChannelCard def={def} rows={rows} />
            </li>
          ))}
        </ul>
      )}

      {tipoFiltro && filteredRows.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Conexiones {channelTypeLabel(tipoFiltro)}
            </h2>
            <Link href="/configuracion/canales" className="text-xs font-semibold text-[#0EA5E9] hover:underline">
              Ver todos los canales
            </Link>
          </div>
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {filteredRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 truncate">{r.nombre ?? channelTypeLabel(r.type)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <ChannelBadge type={r.type} nombre={null} />
                    <span className="text-[10px] uppercase font-semibold text-slate-400">{r.provider}</span>
                  </div>
                </div>
                <Link
                  href={`/configuracion/canales/${r.id}`}
                  className="shrink-0 text-sm font-semibold text-[#0EA5E9] hover:underline"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

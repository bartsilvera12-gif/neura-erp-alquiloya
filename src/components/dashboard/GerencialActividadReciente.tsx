"use client";

import { useEffect, useState } from "react";
import { cachedSessionFetch } from "@/lib/api/cached-session-fetch";
import ActividadReciente from "./ActividadReciente";
import type { ActividadItem } from "./GerencialOverview";

/**
 * Bloque suelto de "Actividad reciente" — se monta al FINAL del dashboard
 * (pedido del cliente). Hace su propio fetch a /api/dashboard/overview, pero
 * comparte cache (60s) y dedup in-flight con GerencialOverview en la parte
 * superior, asi que NO se duplica el round trip de red.
 */
export default function GerencialActividadReciente() {
  const [items, setItems] = useState<ActividadItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const body = await cachedSessionFetch<{
          success?: boolean;
          data?: { actividad?: ActividadItem[] };
          error?: string;
        }>("/api/dashboard/overview", 60 * 1000);
        if (cancelled) return;
        if (body.success && body.data) {
          setItems(Array.isArray(body.data.actividad) ? body.data.actividad : []);
        } else {
          setItems([]);
        }
      } catch {
        if (!cancelled) setItems([]);
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
      <section className="mt-8">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <section className="mt-8">
      <ActividadReciente items={items} />
    </section>
  );
}

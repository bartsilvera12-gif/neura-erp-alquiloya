import Link from "next/link";
import { listErpPropiedades } from "@/lib/alquiloya/erp-propiedades";
import DeletePropiedadButton from "./DeletePropiedadButton";
import ToggleActivoButton from "./ToggleActivoButton";
import ToggleDestacadaButton from "./ToggleDestacadaButton";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtPrecio(precio: number | null, moneda: string | null): string {
  if (precio == null) return "—";
  const m = moneda || "USD";
  try {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: m,
      maximumFractionDigits: 0,
    }).format(precio);
  } catch {
    return `${m} ${precio.toLocaleString("es-PY")}`;
  }
}

export default async function PropiedadesPage() {
  let rows: Awaited<ReturnType<typeof listErpPropiedades>> = [];
  let loadError: string | null = null;
  try {
    rows = await listErpPropiedades();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/propiedades] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Propiedades</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo inmobiliario AlquiloYa.
            {rows.length > 0 && (
              <span className="ml-2 text-slate-400">
                · {rows.length} {rows.length === 1 ? "registro" : "registros"}
              </span>
            )}
          </p>
        </div>
        <Link
          href="/dashboard/propiedades/nueva"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva propiedad
        </Link>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar las propiedades: {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay propiedades cargadas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Foto</th>
                <th className="px-3 py-2.5">Título</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Tipo</th>
                <th className="px-3 py-2.5">Ciudad</th>
                <th className="hidden px-3 py-2.5 xl:table-cell">Barrio</th>
                <th className="px-3 py-2.5 text-right">Precio</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Estado</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Agente</th>
                <th className="px-3 py-2.5">Activo</th>
                <th className="px-3 py-2.5">Destacada</th>
                <th className="sticky right-0 bg-slate-50 px-3 py-2.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    {p.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover_url}
                        alt={p.titulo ?? ""}
                        className="h-12 w-16 rounded-md object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-md bg-slate-100 text-[10px] text-slate-400">
                        s/foto
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{p.titulo ?? "—"}</div>
                    {p.codigo ? (
                      <div className="mt-0.5 text-[11px] text-slate-400">{p.codigo}</div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                      {p.tipo ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{p.tipo}</span> : null}
                      {p.estado ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{p.estado}</span> : null}
                      {p.plan_nombre ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">Plan: {p.plan_nombre}</span> : <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">Sin plan</span>}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">{p.tipo ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{p.ciudad ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-slate-700 xl:table-cell">{p.barrio ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                    {fmtPrecio(p.precio, p.moneda)}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{p.estado ?? "—"}</td>
                  <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{p.agente_nombre ?? "—"}</td>
                  <td className="px-3 py-2"><ToggleActivoButton id={p.id} initial={!!p.activo} titulo={p.titulo} /></td>
                  <td className="px-3 py-2"><ToggleDestacadaButton id={p.id} initialEfectiva={!!p.destacada_efectiva} initialHasta={p.destacada_hasta} titulo={p.titulo} /></td>
                  <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)] group-hover:bg-slate-50">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/dashboard/propiedades/${p.id}`}
                        title="Ver"
                        aria-label="Ver"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#4FAEB2]/10 text-[#3F8E91] ring-1 ring-[#4FAEB2]/30 transition-colors hover:bg-[#4FAEB2]/20"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Link>
                      <Link
                        href={`/dashboard/propiedades/${p.id}/editar`}
                        title="Editar"
                        aria-label="Editar"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-200"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </Link>
                      <DeletePropiedadButton id={p.id} titulo={p.titulo} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

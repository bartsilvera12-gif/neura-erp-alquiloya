import Link from "next/link";
import { listErpPropiedades } from "@/lib/alquiloya/erp-propiedades";

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

function Badge({ on, label }: { on: boolean | null; label: string }) {
  const isOn = !!on;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isOn
          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30"
          : "bg-slate-500/10 text-slate-400 ring-1 ring-slate-500/20"
      }`}
    >
      {label}
    </span>
  );
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
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Propiedades</h1>
          <p className="mt-1 text-sm text-slate-400">
            Catálogo inmobiliario AlquiloYa — vista de solo lectura.
            {rows.length > 0 && (
              <span className="ml-2 text-slate-500">
                · {rows.length} {rows.length === 1 ? "registro" : "registros"}
              </span>
            )}
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          No se pudieron cargar las propiedades: {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-400">
          No hay propiedades cargadas todavía.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.02]">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/[0.08] bg-white/[0.03] text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Foto</th>
                <th className="px-3 py-2.5">Título</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Ciudad</th>
                <th className="px-3 py-2.5">Barrio</th>
                <th className="px-3 py-2.5 text-right">Precio</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Agente</th>
                <th className="px-3 py-2.5">Activo</th>
                <th className="px-3 py-2.5">Web</th>
                <th className="px-3 py-2.5 text-center">Fotos</th>
                <th className="px-3 py-2.5 text-center">Carac.</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    {p.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover_url}
                        alt={p.titulo ?? ""}
                        className="h-12 w-16 rounded-md object-cover ring-1 ring-white/[0.06]"
                      />
                    ) : (
                      <div className="flex h-12 w-16 items-center justify-center rounded-md bg-white/[0.04] text-[10px] text-slate-500">
                        s/foto
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-white">{p.titulo ?? "—"}</div>
                    {p.codigo ? (
                      <div className="mt-0.5 text-[11px] text-slate-500">{p.codigo}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{p.tipo ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{p.ciudad ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{p.barrio ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-200">
                    {fmtPrecio(p.precio, p.moneda)}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{p.estado ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{p.agente_nombre ?? "—"}</td>
                  <td className="px-3 py-2"><Badge on={p.activo} label={p.activo ? "Sí" : "No"} /></td>
                  <td className="px-3 py-2"><Badge on={p.visible_web} label={p.visible_web ? "Pub" : "Priv"} /></td>
                  <td className="px-3 py-2 text-center text-slate-300">{p.fotos_count}</td>
                  <td className="px-3 py-2 text-center text-slate-300">{p.caracteristicas_count}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/propiedades/${p.id}`}
                      className="inline-flex items-center rounded-md bg-[#7DCFD2]/10 px-2.5 py-1 text-xs font-medium text-[#7DCFD2] ring-1 ring-[#7DCFD2]/30 hover:bg-[#7DCFD2]/20"
                    >
                      Ver
                    </Link>
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

import Link from "next/link";
import DeletePropietarioButton from "./DeletePropietarioButton";
import {
  listErpPropietarios,
  type ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY", { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function PlanBadge({ row }: { row: ErpPropietarioRow }) {
  const estado = row.plan_estado;
  const styles: Record<string, string> = {
    sin_plan: "bg-slate-100 text-slate-600 ring-slate-200",
    gratis: "bg-sky-50 text-sky-700 ring-sky-200",
    activo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    por_vencer: "bg-amber-50 text-amber-700 ring-amber-200",
    vencido: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  const labels: Record<string, string> = {
    sin_plan: "SIN PLAN",
    gratis: "GRATIS",
    activo: "ACTIVO",
    por_vencer: "POR VENCER",
    vencido: "VENCIDO",
  };
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${
          styles[estado] ?? styles.sin_plan
        }`}
      >
        {labels[estado] ?? estado}
      </span>
      {row.plan_nombre ? (
        <span className="text-xs font-semibold text-slate-700">{row.plan_nombre}</span>
      ) : null}
      {row.plan_vencimiento_at ? (
        <span className="text-[10px] text-slate-500">vence {fmtDate(row.plan_vencimiento_at)}</span>
      ) : null}
    </div>
  );
}

export default async function PropietariosPage() {
  let propietarios: ErpPropietarioRow[] = [];
  let loadError: string | null = null;
  try {
    propietarios = await listErpPropietarios();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/propietarios] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link
          href="/dashboard/agentes-inmobiliarios"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Agentes inmobiliarios
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Propietarios</h1>
            <p className="mt-1 text-sm text-slate-500">
              Propietarios cargados en AlquiloYa. Algunos publican sin cuenta de acceso;
              al aprobar una solicitud de plan se les crea cuenta de portal automáticamente.
            </p>
          </div>
          <Link
            href="/dashboard/agentes-inmobiliarios/propietarios/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3F8E91] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#357275]"
          >
            + Nuevo propietario
          </Link>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar los propietarios: {loadError}
        </div>
      ) : propietarios.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Todavía no hay propietarios cargados. Se crean automáticamente cuando aprobás solicitudes
          de plan de propietarios no registrados, o desde el botón <strong>Nuevo propietario</strong>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Propietario</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                <th className="px-4 py-3 text-left font-semibold">Documento</th>
                <th className="px-4 py-3 text-left font-semibold">Plan</th>
                <th className="px-4 py-3 text-left font-semibold">Cuenta</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {propietarios.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{p.nombre}</span>
                      {p.tipo_persona ? (
                        <span className="text-[11px] text-slate-500">{p.tipo_persona}</span>
                      ) : null}
                      <span className="text-[10px] text-slate-400">creado {fmtDate(p.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{p.telefono ?? "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{p.documento ?? "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <PlanBadge row={p} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {p.usuario_id ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                        Sí
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 ring-1 ring-slate-200">
                        No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="inline-flex gap-1.5">
                      <Link
                        href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}`}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}/editar`}
                        className="rounded-md bg-[#3F8E91] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#357275]"
                      >
                        Editar
                      </Link>
                      <DeletePropietarioButton id={p.id} nombre={p.nombre} />
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

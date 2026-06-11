import Link from "next/link";
import { notFound } from "next/navigation";
import { getErpPropietario } from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import { AccesoBlock } from "../../_components/AccesoBlock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function PropietarioDetailPage({ params }: Props) {
  const { id } = await params;
  const p = await getErpPropietario(id);
  if (!p) notFound();

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/dashboard/agentes-inmobiliarios"
            className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
          >
            ← Volver al listado
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{p.nombre}</h1>
          <p className="mt-1 text-sm text-slate-500">{p.tipo_persona ?? "Propietario"}</p>
        </div>
        <Link
          href={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}/editar`}
          className="inline-flex items-center rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3F8E91]"
        >
          Editar
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Email" value={p.email} />
            <Field label="Teléfono" value={p.telefono} />
            <Field label="Documento" value={p.documento} />
            <Field label="Tipo de persona" value={p.tipo_persona} />
            <Field label="Estado" value={p.estado} />
            <Field label="Activo" value={p.activo ? "Sí" : "No"} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plan de publicación</dt>
              <dd className="mt-0.5 text-sm text-slate-800">
                {p.plan_publicacion_id ? (
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${planEstadoCls(p.plan_estado)}`}>
                      {planEstadoLabel(p.plan_estado)}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{p.plan_nombre ?? p.plan_tier ?? "—"}</span>
                    {p.plan_estado !== "gratis" && p.plan_estado !== "sin_plan" && p.plan_vencimiento_at ? (
                      <span className="text-xs text-slate-500">
                        Vence {new Date(p.plan_vencimiento_at).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-slate-400">Sin plan asignado</span>
                )}
              </dd>
            </div>
            <Field label="Alta" value={p.created_at} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Observaciones</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                {p.observaciones ?? <span className="text-slate-400">—</span>}
              </dd>
            </div>
          </dl>
        </section>

        <AccesoBlock
          acceso={p.acceso}
          tipo="propietario"
          targetId={p.id}
          defaultEmail={p.email}
        />
      </div>
    </div>
  );
}

function planEstadoLabel(e: string): string {
  switch (e) {
    case "activo": return "Activo";
    case "por_vencer": return "Por vencer";
    case "vencido": return "Vencido";
    case "gratis": return "Gratis";
    default: return "Sin plan";
  }
}
function planEstadoCls(e: string): string {
  switch (e) {
    case "activo": return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "por_vencer": return "bg-amber-100 text-amber-700 ring-amber-200";
    case "vencido": return "bg-rose-100 text-rose-700 ring-rose-200";
    case "gratis": return "bg-sky-100 text-sky-700 ring-sky-200";
    default: return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">
        {value ?? <span className="text-slate-400">—</span>}
      </dd>
    </div>
  );
}

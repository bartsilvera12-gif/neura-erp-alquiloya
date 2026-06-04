import {
  listErpPropiedadesPendientes,
  type ErpPropiedadPendienteRow,
} from "@/lib/alquiloya/erp-propiedades";
import PropiedadesPendientesClient from "./PropiedadesPendientesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PropiedadesPendientesPage() {
  let rows: ErpPropiedadPendienteRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await listErpPropiedadesPendientes();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/propiedades-pendientes] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Propiedades pendientes de aprobación
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Inmuebles cargados desde el sitio público que esperan revisión antes de publicarse.
          Aprobar activa la propiedad y la hace visible en la web.
          {rows.length > 0 && (
            <span className="ml-2 text-amber-700">
              · {rows.length} {rows.length === 1 ? "pendiente" : "pendientes"}
            </span>
          )}
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar las propiedades pendientes: {loadError}
        </div>
      ) : (
        <PropiedadesPendientesClient initial={rows} />
      )}
    </div>
  );
}

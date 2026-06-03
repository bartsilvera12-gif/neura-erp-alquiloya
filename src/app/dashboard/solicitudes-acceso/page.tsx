import {
  listErpSolicitudesAcceso,
  type SolicitudAccesoRow,
} from "@/lib/alquiloya/erp-solicitudes-acceso";
import SolicitudesAccesoClient from "./SolicitudesAccesoClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SolicitudesAccesoPage() {
  let rows: SolicitudAccesoRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await listErpSolicitudesAcceso();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/solicitudes-acceso] load", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Solicitudes de acceso
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pedidos enviados desde la web pública por agentes inmobiliarios y propietarios. Aprobar
          crea la cuenta correspondiente en el módulo Agentes inmobiliarios.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar las solicitudes: {loadError}
        </div>
      ) : (
        <SolicitudesAccesoClient initial={rows} />
      )}
    </div>
  );
}

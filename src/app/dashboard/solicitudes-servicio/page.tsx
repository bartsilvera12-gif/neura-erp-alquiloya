import Link from "next/link";
import {
  listErpSolicitudesServicio,
  type SolicitudServicioRow,
} from "@/lib/alquiloya/erp-solicitudes-servicio";
import {
  listErpPropietarios,
  type ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import SolicitudesServicioClient from "./SolicitudesServicioClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SolicitudesServicioPage() {
  let rows: SolicitudServicioRow[] = [];
  let propietarios: ErpPropietarioRow[] = [];
  let loadError: string | null = null;
  try {
    rows = await listErpSolicitudesServicio();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/solicitudes-servicio] load", e);
  }
  try {
    propietarios = await listErpPropietarios();
  } catch {
    // best-effort
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link
          href="/"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Volver al dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Solicitudes de servicio
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cambios de plan, compras de impulsos y verificaciones de inmueble enviadas desde la web pública. Al aprobar, el ERP actualiza el registro correspondiente.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar las solicitudes: {loadError}
        </div>
      ) : (
        <SolicitudesServicioClient
          initial={rows}
          propietarios={propietarios.map((p) => ({ id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono }))}
        />
      )}
    </div>
  );
}

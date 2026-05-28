import {
  listErpAgentesInmobiliarios,
  listErpPropietarios,
  type ErpAgenteInmobiliarioRow,
  type ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import { AgentesInmobiliariosClient } from "./AgentesInmobiliariosClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgentesInmobiliariosPage() {
  let agentes: ErpAgenteInmobiliarioRow[] = [];
  let propietarios: ErpPropietarioRow[] = [];
  let agentesError: string | null = null;
  let propietariosError: string | null = null;

  try {
    agentes = await listErpAgentesInmobiliarios();
  } catch (e) {
    agentesError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/agentes-inmobiliarios] agentes", e);
  }

  try {
    propietarios = await listErpPropietarios();
  } catch (e) {
    propietariosError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/agentes-inmobiliarios] propietarios", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Agentes inmobiliarios
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestión de cuentas externas (agentes y propietarios) que publican en
          AlquiloYa. No incluye usuarios internos del ERP.
        </p>
      </header>

      <AgentesInmobiliariosClient
        agentes={agentes}
        propietarios={propietarios}
        agentesError={agentesError}
        propietariosError={propietariosError}
      />
    </div>
  );
}

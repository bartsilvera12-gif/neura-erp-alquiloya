import Link from "next/link";
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Agentes inmobiliarios
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestión de cuentas externas (agentes y propietarios) que publican en
            AlquiloYa. No incluye usuarios internos del ERP.
          </p>
        </div>
        <Link
          href="/dashboard/agentes-inmobiliarios/captaciones"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#4FAEB2]/30 bg-white px-3.5 py-2 text-sm font-semibold text-[#3F8E91] shadow-sm hover:bg-[#4FAEB2]/10"
        >
          Dashboard captaciones →
        </Link>
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

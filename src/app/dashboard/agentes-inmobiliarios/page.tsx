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
          className="inline-flex items-center gap-2 rounded-xl bg-[#4FAEB2] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="9" rx="1.5" />
            <rect x="14" y="3" width="7" height="5" rx="1.5" />
            <rect x="14" y="12" width="7" height="9" rx="1.5" />
            <rect x="3" y="16" width="7" height="5" rx="1.5" />
          </svg>
          Dashboard captaciones
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

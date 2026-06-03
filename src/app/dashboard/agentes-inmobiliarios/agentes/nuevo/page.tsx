import Link from "next/link";
import { AgenteForm } from "../AgenteForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function NuevoAgentePage() {
  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link
          href="/dashboard/agentes-inmobiliarios"
          className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
        >
          ← Volver al listado
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nuevo agente inmobiliario</h1>
        <p className="mt-1 text-sm text-slate-500">
          Alta inicial del perfil público. El acceso al portal se crea en una fase aparte.
        </p>
      </header>

      <AgenteForm
        mode="create"
        initial={{
          nombre: "",
          email: "",
          telefono: "",
          whatsapp: "",
          cargo: "",
          bio: "",
          foto_url: "",
          orden: 0,
          activo: true,
          verificado: false,
          nivel: "",
          idiomas: "",
          tiempo_respuesta: "",
          tasa_respuesta: "",
        }}
      />
    </div>
  );
}

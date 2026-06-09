import Link from "next/link";
import { notFound } from "next/navigation";
import { getErpAgenteInmobiliario } from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import { AgenteForm } from "../../AgenteForm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function EditarAgentePage({ params }: Props) {
  const { id } = await params;
  const a = await getErpAgenteInmobiliario(id);
  if (!a) notFound();

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/dashboard/agentes-inmobiliarios/agentes/${a.id}`}
            className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]"
          >
            ← Volver al detalle
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Editar agente</h1>
          <p className="mt-1 text-sm text-slate-500">{a.nombre ?? "—"}</p>
        </div>
        {/* Acceso a Reseñas del agente — el item del sidebar fue removido a pedido del cliente. */}
        <Link
          href={`/dashboard/agente-resenas?agente=${encodeURIComponent(a.id)}`}
          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Reseñas →
        </Link>
      </header>

      <AgenteForm
        mode="edit"
        initial={{
          id: a.id,
          nombre: a.nombre ?? "",
          email: a.email ?? "",
          telefono: a.telefono ?? "",
          whatsapp: a.whatsapp ?? "",
          cargo: a.cargo ?? "",
          bio: a.bio ?? "",
          foto_url: a.foto_url ?? "",
          logo_empresa_url: (a as { logo_empresa_url?: string | null }).logo_empresa_url ?? "",
          orden: a.orden ?? 0,
          activo: a.activo ?? true,
          verificado: a.verificado ?? false,
          nivel: a.nivel ?? "",
          idiomas: a.idiomas ?? "",
          tiempo_respuesta: a.tiempo_respuesta ?? "",
          tasa_respuesta: a.tasa_respuesta ?? "",
        }}
      />
    </div>
  );
}

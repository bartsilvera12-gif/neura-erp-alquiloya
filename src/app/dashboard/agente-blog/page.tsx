import {
  listErpAgentePosts,
  type AgentePostRow,
} from "@/lib/alquiloya/erp-agente-posts";
import { listErpAgentesInmobiliarios } from "@/lib/alquiloya/erp-agentes-inmobiliarios";
import AgenteBlogClient from "./AgenteBlogClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AgenteBlogPage() {
  let posts: AgentePostRow[] = [];
  let agentes: Array<{ id: string; nombre: string | null }> = [];
  let loadError: string | null = null;
  try {
    posts = await listErpAgentePosts();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Error desconocido";
    console.error("[dashboard/agente-blog] load posts", e);
  }
  try {
    const ags = await listErpAgentesInmobiliarios();
    agentes = ags.map((a) => ({ id: a.id, nombre: a.nombre }));
  } catch (e) {
    console.error("[dashboard/agente-blog] load agentes", e);
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Blog de agentes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Posts publicados aparecen en el perfil público de cada agente en /publico.
        </p>
      </header>
      {loadError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          No se pudieron cargar los posts: {loadError}
        </div>
      ) : (
        <AgenteBlogClient initial={posts} agentes={agentes} />
      )}
    </div>
  );
}

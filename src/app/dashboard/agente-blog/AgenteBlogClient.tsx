"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { AgentePostRow } from "@/lib/alquiloya/erp-agente-posts";

type AgOpt = { id: string; nombre: string | null };
type Editing = Partial<AgentePostRow> & { isNew?: boolean };

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function AgenteBlogClient({
  initial,
  agentes,
}: {
  initial: AgentePostRow[];
  agentes: AgOpt[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<AgentePostRow[]>(initial);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<AgentePostRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterAgente, setFilterAgente] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<"todos" | "publicado" | "borrador">("todos");

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filterAgente && p.agente_id !== filterAgente) return false;
      if (filterEstado === "publicado" && !p.publicado) return false;
      if (filterEstado === "borrador" && p.publicado) return false;
      return true;
    });
  }, [posts, filterAgente, filterEstado]);

  async function save() {
    if (!editing) return;
    setErr(null);
    if (!editing.titulo?.trim()) { setErr("El título es obligatorio"); return; }
    if (!editing.agente_id) { setErr("Elegí el agente"); return; }
    setSaving(true);
    try {
      const isNew = editing.isNew;
      const payload: Record<string, unknown> = {
        agente_id: editing.agente_id,
        titulo: editing.titulo,
        slug: editing.slug ?? null,
        resumen: editing.resumen ?? null,
        contenido: editing.contenido ?? null,
        cover_url: editing.cover_url ?? null,
        publicado: editing.publicado ?? false,
        destacado: editing.destacado ?? false,
        orden: editing.orden ?? 0,
      };
      const url = isNew
        ? "/api/dashboard/alquiloya-agente-posts"
        : `/api/dashboard/alquiloya-agente-posts/${editing.id}`;
      const res = await fetchWithSupabaseSession(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEditing(null);
      router.refresh();
      // Re-fetch posts from /dashboard via reload (router.refresh re-runs server component).
      // Optimistic in-memory:
      const agente = agentes.find((a) => a.id === editing.agente_id) ?? null;
      const saved: AgentePostRow = {
        id: data.id ?? editing.id!,
        agente_id: editing.agente_id!,
        agente_nombre: agente?.nombre ?? null,
        slug: editing.slug ?? "",
        titulo: editing.titulo!,
        resumen: editing.resumen ?? null,
        contenido: editing.contenido ?? null,
        cover_url: editing.cover_url ?? null,
        publicado: editing.publicado ?? false,
        destacado: editing.destacado ?? false,
        orden: editing.orden ?? 0,
        publicado_at: editing.publicado ? new Date().toISOString() : null,
        created_at: editing.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setPosts((prev) => isNew ? [saved, ...prev] : prev.map((p) => (p.id === saved.id ? saved : p)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      const res = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-agente-posts/${deleting.id}`,
        { method: "DELETE" }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPosts((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setBusyId(null);
    }
  }

  function newPost() {
    setEditing({
      isNew: true,
      agente_id: agentes[0]?.id,
      titulo: "",
      slug: "",
      resumen: "",
      contenido: "",
      cover_url: "",
      publicado: false,
      destacado: false,
      orden: 0,
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterAgente}
            onChange={(e) => setFilterAgente(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
          >
            <option value="">Todos los agentes</option>
            {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre || "Sin nombre"}</option>)}
          </select>
          {(["todos","publicado","borrador"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFilterEstado(e)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                filterEstado === e
                  ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {e === "todos" ? "Todos" : e === "publicado" ? "Publicados" : "Borradores"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={newPost}
          disabled={agentes.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3F8E91] disabled:opacity-50"
        >
          + Nuevo post
        </button>
      </div>

      {agentes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay agentes cargados. Creá uno desde Agentes inmobiliarios para empezar a publicar.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          No hay posts con esos filtros.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Post</th>
                <th className="hidden px-3 py-2.5 md:table-cell">Agente</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="hidden px-3 py-2.5 lg:table-cell">Publicado</th>
                <th className="px-3 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-3">
                      {p.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_url} alt={p.titulo} className="h-12 w-16 rounded object-cover ring-1 ring-slate-200" />
                      ) : (
                        <div className="grid h-12 w-16 place-items-center rounded bg-slate-100 text-[10px] text-slate-400">s/cover</div>
                      )}
                      <div className="min-w-0">
                        <div className="line-clamp-1 font-medium text-slate-900">{p.titulo}</div>
                        {p.slug ? <div className="text-[11px] font-mono text-slate-400">/{p.slug}</div> : null}
                        {p.resumen ? <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.resumen}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-slate-700 md:table-cell">{p.agente_nombre ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                      p.publicado
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}>
                      {p.publicado ? "Publicado" : "Borrador"}
                    </span>
                    {p.destacado ? (
                      <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">★</span>
                    ) : null}
                  </td>
                  <td className="hidden px-3 py-2 text-slate-500 lg:table-cell">{fmtDate(p.publicado_at)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing({ ...p, isNew: false })}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(p)}
                        disabled={busyId === p.id}
                        className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !saving && setEditing(null)} />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
            <h3 className="text-base font-semibold text-slate-900">
              {editing.isNew ? "Nuevo post" : "Editar post"}
            </h3>
            {err ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>Agente *</label>
                <select
                  className={inputCls}
                  value={editing.agente_id ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, agente_id: e.target.value }))}
                >
                  {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre || "Sin nombre"}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Título *</label>
                <input
                  className={inputCls}
                  value={editing.titulo ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, titulo: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Slug</label>
                <input
                  className={inputCls}
                  placeholder="dejar-vacio-para-generar-automaticamente"
                  value={editing.slug ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, slug: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Cover URL</label>
                <input
                  className={inputCls}
                  placeholder="https://…"
                  value={editing.cover_url ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, cover_url: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Resumen (1-2 líneas)</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={editing.resumen ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, resumen: e.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Contenido</label>
                <textarea
                  rows={10}
                  className={inputCls + " font-mono text-[13px]"}
                  placeholder="Markdown o texto plano. Soporta salto de línea simple."
                  value={editing.contenido ?? ""}
                  onChange={(e) => setEditing((x) => ({ ...x!, contenido: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Orden</label>
                <input
                  type="number"
                  className={inputCls}
                  value={editing.orden ?? 0}
                  onChange={(e) => setEditing((x) => ({ ...x!, orden: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex items-end gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.publicado ?? false}
                    onChange={(e) => setEditing((x) => ({ ...x!, publicado: e.target.checked }))}
                  />
                  Publicado
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.destacado ?? false}
                    onChange={(e) => setEditing((x) => ({ ...x!, destacado: e.target.checked }))}
                  />
                  Destacado
                </label>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200">
                Cancelar
              </button>
              <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar post"
        description={deleting ? <>Vas a eliminar &quot;<strong>{deleting.titulo}</strong>&quot;. Esta acción no se puede deshacer.</> : null}
        confirmLabel="Eliminar"
        tone="danger"
        busy={!!busyId}
        onConfirm={doDelete}
        onCancel={() => !busyId && setDeleting(null)}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import ConfirmDialog from "@/components/ConfirmDialog";
import type {
  ErpAgenteInmobiliarioRow,
  ErpPropietarioRow,
} from "@/lib/alquiloya/erp-agentes-inmobiliarios";

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function IconPower() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

type Tab = "agentes" | "propietarios";
type Kind = "agente" | "propietario";
type ActionKind = "desactivar" | "reactivar" | "eliminar";

type PlanEstadoUI = "sin_plan" | "gratis" | "activo" | "por_vencer" | "vencido";

const PLAN_ESTADO_LABEL: Record<PlanEstadoUI, string> = {
  sin_plan: "Sin plan",
  gratis: "Gratis",
  activo: "Activo",
  por_vencer: "Por vencer",
  vencido: "Vencido",
};

const PLAN_ESTADO_CLS: Record<PlanEstadoUI, string> = {
  sin_plan: "bg-slate-100 text-slate-600 ring-slate-200",
  gratis: "bg-sky-100 text-sky-700 ring-sky-200",
  activo: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  por_vencer: "bg-amber-100 text-amber-700 ring-amber-200",
  vencido: "bg-rose-100 text-rose-700 ring-rose-200",
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function PlanCell({
  estado,
  nombre,
  tier,
  vencimiento,
}: {
  estado: PlanEstadoUI;
  nombre: string | null;
  tier: string | null;
  vencimiento: string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${PLAN_ESTADO_CLS[estado]}`}
      >
        {PLAN_ESTADO_LABEL[estado]}
      </span>
      {nombre || tier ? (
        <span className="text-xs font-medium text-slate-700">{nombre ?? tier}</span>
      ) : null}
      {estado !== "sin_plan" && estado !== "gratis" && vencimiento ? (
        <span className="text-[10px] text-slate-500">vence {fmtFecha(vencimiento)}</span>
      ) : null}
    </div>
  );
}

function PlanFilter({
  value,
  counts,
  onChange,
}: {
  value: "todos" | PlanEstadoUI;
  counts: Record<"todos" | PlanEstadoUI, number>;
  onChange: (v: "todos" | PlanEstadoUI) => void;
}) {
  const opts: Array<{ key: "todos" | PlanEstadoUI; label: string }> = [
    { key: "todos", label: "Todos" },
    { key: "activo", label: "Activo" },
    { key: "por_vencer", label: "Por vencer" },
    { key: "vencido", label: "Vencido" },
    { key: "gratis", label: "Gratis" },
    { key: "sin_plan", label: "Sin plan" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Plan</span>
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
            value === o.key
              ? "bg-[#4FAEB2] text-white ring-[#4FAEB2]"
              : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          {o.label}
          <span
            className={`rounded-full px-1.5 text-[10px] ${
              value === o.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
            }`}
          >
            {counts[o.key] ?? 0}
          </span>
        </button>
      ))}
    </div>
  );
}

function Badge({ on, label }: { on: boolean | null; label: string }) {
  const isOn = !!on;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        isOn
          ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      {label}
    </span>
  );
}

export function AgentesInmobiliariosClient({
  agentes,
  agentesError,
}: {
  agentes: ErpAgenteInmobiliarioRow[];
  // Las props de propietarios siguen aceptandose para compat con el page,
  // pero el tab fue removido del cliente: AlquiloYa ya no gestiona
  // propietarios desde este modulo (los dueños publican sin cuenta).
  propietarios?: ErpPropietarioRow[];
  agentesError: string | null;
  propietariosError?: string | null;
}) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-200 pb-3">
        <h2 className="text-base font-semibold text-slate-800">
          Agentes inmobiliarios
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {agentes.length}
          </span>
        </h2>
        <Link
          href="/dashboard/agentes-inmobiliarios/agentes/nuevo"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4FAEB2] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91]"
        >
          + Nuevo agente
        </Link>
      </div>

      <AgentesTab rows={agentes} error={agentesError} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "border-[#4FAEB2] text-[#3F8E91]"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function useToggleHandler(kind: Kind) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | { id: string; nombre: string | null; action: ActionKind }
    | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  const endpoint = kind === "agente" ? "alquiloya-agentes" : "alquiloya-propietarios";
  const noun = kind === "agente" ? "agente" : "propietario";

  async function run() {
    if (!pending) return;
    const { id, action } = pending;
    setBusyId(id);
    setErr(null);
    try {
      let res: Response;
      if (action === "reactivar") {
        res = await fetchWithSupabaseSession(`/api/dashboard/${endpoint}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activo: true }),
        });
      } else if (action === "desactivar") {
        res = await fetchWithSupabaseSession(`/api/dashboard/${endpoint}/${id}`, {
          method: "DELETE",
        });
      } else {
        res = await fetchWithSupabaseSession(`/api/dashboard/${endpoint}/${id}?hard=true`, {
          method: "DELETE",
        });
      }
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setPending(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, pending, setPending, err, setErr, run, noun };
}

function ActionsCell({
  active,
  viewHref,
  editHref,
  onDesactivar,
  onReactivar,
  onEliminar,
  onCambiarPlan,
  disabled,
}: {
  active: boolean;
  viewHref: string;
  editHref: string;
  onDesactivar: () => void;
  onReactivar: () => void;
  onEliminar: () => void;
  onCambiarPlan?: () => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Link
        href={viewHref}
        title="Ver"
        aria-label="Ver"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#4FAEB2]/10 text-[#3F8E91] ring-1 ring-[#4FAEB2]/30 transition-colors hover:bg-[#4FAEB2]/20"
      >
        <IconEye />
      </Link>
      <Link
        href={editHref}
        title="Editar"
        aria-label="Editar"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-200"
      >
        <IconPencil />
      </Link>
      {onCambiarPlan && (
        <button
          type="button"
          onClick={onCambiarPlan}
          disabled={disabled}
          title="Cambiar plan"
          aria-label="Cambiar plan"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 transition-colors hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60"
        >
          <IconTag />
        </button>
      )}
      {active ? (
        <button
          type="button"
          onClick={onDesactivar}
          disabled={disabled}
          title="Desactivar"
          aria-label="Desactivar"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 ring-1 ring-rose-200 transition-colors hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
        >
          <IconPower />
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onReactivar}
            disabled={disabled}
            title="Reactivar"
            aria-label="Reactivar"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
          >
            <IconPower />
          </button>
          <button
            type="button"
            onClick={onEliminar}
            disabled={disabled}
            title="Eliminar definitivamente"
            aria-label="Eliminar definitivamente"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-rose-600 text-white ring-1 ring-rose-700 transition-colors hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
          >
            <IconTrash />
          </button>
        </>
      )}
    </div>
  );
}

function ConfirmFor({
  pending,
  busy,
  noun,
  onConfirm,
  onCancel,
}: {
  pending: { id: string; nombre: string | null; action: ActionKind } | null;
  busy: boolean;
  noun: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pending) return <ConfirmDialog open={false} title="" onConfirm={() => {}} onCancel={() => {}} />;
  const display = pending.nombre?.trim() || `este ${noun}`;
  const cfg: Record<ActionKind, { title: string; confirmLabel: string; tone: "danger" | "default"; description: React.ReactNode }> = {
    desactivar: {
      title: `Desactivar ${noun}`,
      confirmLabel: "Desactivar",
      tone: "danger",
      description: (
        <>
          Vas a desactivar a <strong className="text-slate-900">{display}</strong>.
          <br />
          Dejará de aparecer en la web pública, pero <em>los datos históricos se conservan</em>.
          <br />
          Podés reactivarlo cuando quieras.
        </>
      ),
    },
    reactivar: {
      title: `Reactivar ${noun}`,
      confirmLabel: "Reactivar",
      tone: "default",
      description: (
        <>
          Vas a reactivar a <strong className="text-slate-900">{display}</strong>.
          <br />
          Volverá a aparecer en la web pública.
        </>
      ),
    },
    eliminar: {
      title: `Eliminar definitivamente`,
      confirmLabel: "Eliminar para siempre",
      tone: "danger",
      description: (
        <>
          <strong className="text-rose-700">Atención:</strong> esta acción borra a{" "}
          <strong className="text-slate-900">{display}</strong> de la base.
          <br />
          No se podrá recuperar. Si tiene captaciones, propiedades u otros vínculos, la eliminación va a fallar y deberás resolverlos primero.
        </>
      ),
    },
  };
  const c = cfg[pending.action];
  return (
    <ConfirmDialog
      open={true}
      title={c.title}
      description={c.description}
      confirmLabel={c.confirmLabel}
      cancelLabel="Cancelar"
      tone={c.tone}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function AgentesTab({
  rows,
  error,
}: {
  rows: ErpAgenteInmobiliarioRow[];
  error: string | null;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [planFilter, setPlanFilter] = useState<"todos" | PlanEstadoUI>("todos");
  const { busyId, pending, setPending, err, setErr, run, noun } = useToggleHandler("agente");
  // Estado del modal "Cambiar plan" — guarda el agente sobre el que se
  // edita el plan. null = modal cerrado.
  const [planTarget, setPlanTarget] = useState<ErpAgenteInmobiliarioRow | null>(null);

  const inactiveCount = useMemo(() => rows.filter((r) => !r.activo).length, [rows]);
  const planCounts = useMemo(() => {
    const c: Record<"todos" | PlanEstadoUI, number> = {
      todos: 0, activo: 0, por_vencer: 0, vencido: 0, gratis: 0, sin_plan: 0,
    };
    const pool = showInactive ? rows.filter((r) => !r.activo) : rows.filter((r) => r.activo);
    for (const r of pool) {
      c.todos += 1;
      c[r.plan_estado as PlanEstadoUI] = (c[r.plan_estado as PlanEstadoUI] ?? 0) + 1;
    }
    return c;
  }, [rows, showInactive]);
  const visibleRows = useMemo(() => {
    const base = showInactive ? rows.filter((r) => !r.activo) : rows.filter((r) => r.activo);
    if (planFilter === "todos") return base;
    return base.filter((r) => r.plan_estado === planFilter);
  }, [rows, showInactive, planFilter]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los agentes: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        No hay agentes inmobiliarios cargados todavía.
      </div>
    );
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <PlanFilter value={planFilter} counts={planCounts} onChange={setPlanFilter} />
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
          />
          Ver desactivados
          {inactiveCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {inactiveCount}
            </span>
          ) : null}
        </label>
      </div>
      {err ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Agente</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Cargo</th>
              <th className="px-3 py-2.5">Teléfono</th>
              <th className="hidden px-3 py-2.5 lg:table-cell">Email</th>
              <th className="hidden px-3 py-2.5 text-center md:table-cell">Propiedades</th>
              <th className="px-3 py-2.5">Plan</th>
              <th className="px-3 py-2.5">Activo</th>
              <th className="sticky right-0 bg-slate-50 px-3 py-2.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                  {showInactive
                    ? "No hay agentes desactivados que coincidan."
                    : "No hay agentes activos que coincidan con el filtro."}
                </td>
              </tr>
            ) : (
              visibleRows.map((a) => {
                const dim = !a.activo;
                return (
                  <tr key={a.id} className={`hover:bg-slate-50 ${dim ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {a.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.foto_url}
                            alt={a.nombre ?? ""}
                            className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                            {(a.nombre ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="font-medium text-slate-900">{a.nombre ?? "—"}</div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2 text-slate-700 md:table-cell">{a.cargo ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{a.telefono ?? a.whatsapp ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{a.email ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-center text-slate-700 tabular-nums md:table-cell">
                      {a.propiedades_count}
                    </td>
                    <td className="px-3 py-2">
                      <PlanCell
                        estado={a.plan_estado as PlanEstadoUI}
                        nombre={a.plan_nombre}
                        tier={a.plan_tier}
                        vencimiento={a.plan_vencimiento_at}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Badge on={a.activo} label={a.activo ? "Sí" : "No"} />
                    </td>
                    <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                      <ActionsCell
                        active={!!a.activo}
                        viewHref={`/dashboard/agentes-inmobiliarios/agentes/${a.id}`}
                        editHref={`/dashboard/agentes-inmobiliarios/agentes/${a.id}/editar`}
                        onDesactivar={() => { setErr(null); setPending({ id: a.id, nombre: a.nombre, action: "desactivar" }); }}
                        onReactivar={() => { setErr(null); setPending({ id: a.id, nombre: a.nombre, action: "reactivar" }); }}
                        onEliminar={() => { setErr(null); setPending({ id: a.id, nombre: a.nombre, action: "eliminar" }); }}
                        onCambiarPlan={a.activo ? () => { setErr(null); setPlanTarget(a); } : undefined}
                        disabled={busyId === a.id}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ConfirmFor
        pending={pending}
        busy={busyId === pending?.id}
        noun={noun}
        onConfirm={run}
        onCancel={() => busyId !== pending?.id && setPending(null)}
      />
      {planTarget && (
        <CambiarPlanModal
          agente={planTarget}
          onClose={() => setPlanTarget(null)}
        />
      )}
    </>
  );
}

function PropietariosTab({
  rows,
  error,
}: {
  rows: ErpPropietarioRow[];
  error: string | null;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [planFilter, setPlanFilter] = useState<"todos" | PlanEstadoUI>("todos");
  const { busyId, pending, setPending, err, setErr, run, noun } = useToggleHandler("propietario");

  const inactiveCount = useMemo(() => rows.filter((r) => !r.activo).length, [rows]);
  const planCounts = useMemo(() => {
    const c: Record<"todos" | PlanEstadoUI, number> = {
      todos: 0, activo: 0, por_vencer: 0, vencido: 0, gratis: 0, sin_plan: 0,
    };
    const pool = showInactive ? rows.filter((r) => !r.activo) : rows.filter((r) => r.activo);
    for (const r of pool) {
      c.todos += 1;
      c[r.plan_estado as PlanEstadoUI] = (c[r.plan_estado as PlanEstadoUI] ?? 0) + 1;
    }
    return c;
  }, [rows, showInactive]);
  const visibleRows = useMemo(() => {
    const base = showInactive ? rows.filter((r) => !r.activo) : rows.filter((r) => r.activo);
    if (planFilter === "todos") return base;
    return base.filter((r) => r.plan_estado === planFilter);
  }, [rows, showInactive, planFilter]);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        No se pudieron cargar los propietarios: {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
        Todavía no hay propietarios registrados.
      </div>
    );
  }
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <PlanFilter value={planFilter} counts={planCounts} onChange={setPlanFilter} />
        <label className="inline-flex cursor-pointer items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]"
          />
          Ver desactivados
          {inactiveCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {inactiveCount}
            </span>
          ) : null}
        </label>
      </div>
      {err ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Nombre</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Tipo</th>
              <th className="hidden px-3 py-2.5 lg:table-cell">Documento</th>
              <th className="px-3 py-2.5">Teléfono</th>
              <th className="hidden px-3 py-2.5 lg:table-cell">Email</th>
              <th className="hidden px-3 py-2.5 xl:table-cell">Estado</th>
              <th className="px-3 py-2.5">Activo</th>
              <th className="hidden px-3 py-2.5 xl:table-cell">Usuario</th>
              <th className="px-3 py-2.5">Plan</th>
              <th className="sticky right-0 bg-slate-50 px-3 py-2.5 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                  {showInactive
                    ? "No hay propietarios desactivados."
                    : "No hay propietarios activos. Activá \"Ver desactivados\" para verlos."}
                </td>
              </tr>
            ) : (
              visibleRows.map((p) => {
                const dim = !p.activo;
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 ${dim ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{p.nombre}</td>
                    <td className="hidden px-3 py-2 text-slate-700 md:table-cell">{p.tipo_persona ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{p.documento ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{p.telefono ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-slate-700 lg:table-cell">{p.email ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-slate-700 xl:table-cell">{p.estado ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge on={p.activo} label={p.activo ? "Sí" : "No"} />
                    </td>
                    <td className="hidden px-3 py-2 text-slate-500 xl:table-cell">
                      {p.usuario_id ? <span className="text-emerald-700">vinculado</span> : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <PlanCell
                        estado={p.plan_estado as PlanEstadoUI}
                        nombre={p.plan_nombre}
                        tier={p.plan_tier}
                        vencimiento={p.plan_vencimiento_at}
                      />
                    </td>
                    <td className="sticky right-0 bg-white px-3 py-2 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.08)]">
                      <ActionsCell
                        active={!!p.activo}
                        viewHref={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}`}
                        editHref={`/dashboard/agentes-inmobiliarios/propietarios/${p.id}/editar`}
                        onDesactivar={() => { setErr(null); setPending({ id: p.id, nombre: p.nombre, action: "desactivar" }); }}
                        onReactivar={() => { setErr(null); setPending({ id: p.id, nombre: p.nombre, action: "reactivar" }); }}
                        onEliminar={() => { setErr(null); setPending({ id: p.id, nombre: p.nombre, action: "eliminar" }); }}
                        disabled={busyId === p.id}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <ConfirmFor
        pending={pending}
        busy={busyId === pending?.id}
        noun={noun}
        onConfirm={run}
        onCancel={() => busyId !== pending?.id && setPending(null)}
      />
    </>
  );
}

// ── CambiarPlanModal ────────────────────────────────────────────────────────
// Lista los planes activos del dashboard y deja al admin asignar uno (o
// quitarlo) a un agente + fijar vencimiento. Pega un PATCH al endpoint
// /api/dashboard/alquiloya-agentes/[id] con { plan_publicacion_id,
// plan_vencimiento_at }. Refresca la pagina al guardar.
type PlanRow = {
  id: string;
  tier: string | null;
  nombre: string | null;
  billing: string | null;
};

function CambiarPlanModal({
  agente,
  onClose,
}: {
  agente: ErpAgenteInmobiliarioRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [planes, setPlanes] = useState<PlanRow[] | null>(null);
  const [planId, setPlanId] = useState<string>(agente.plan_publicacion_id ?? "");
  // Default: si el agente ya tenia vencimiento, lo prefilleamos. Si no, 30 dias
  // a partir de hoy (calculado al renderizar — no usa Date.now() en cache).
  const initialFecha = (() => {
    if (agente.plan_vencimiento_at) {
      try {
        return new Date(agente.plan_vencimiento_at).toISOString().slice(0, 10);
      } catch { /* ignore */ }
    }
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();
  const [vencimiento, setVencimiento] = useState<string>(initialFecha);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Carga la lista una vez al montar.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchWithSupabaseSession("/api/dashboard/alquiloya-planes-publicacion");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const body = (await r.json()) as { data?: { planes?: PlanRow[] }; planes?: PlanRow[] };
        if (cancelled) return;
        const list = body?.data?.planes ?? body?.planes ?? [];
        setPlanes(list);
      } catch (e) {
        if (cancelled) return;
        setPlanes([]);
        setErr(e instanceof Error ? e.message : "No pudimos cargar los planes");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function guardar() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        plan_publicacion_id: planId || null,
        plan_vencimiento_at: planId && vencimiento ? new Date(vencimiento + "T00:00:00").toISOString() : null,
      };
      const r = await fetchWithSupabaseSession(
        `/api/dashboard/alquiloya-agentes/${agente.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? "HTTP " + r.status);
      }
      onClose();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="mt-16 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900">Cambiar plan</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Agente: <strong className="text-slate-700">{agente.nombre ?? "—"}</strong>
          </p>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Plan
        </label>
        <select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
          disabled={planes === null}
          className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30"
        >
          <option value="">Sin plan</option>
          {(planes ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre ?? p.tier ?? p.id}
              {p.billing ? ` · ${p.billing}` : ""}
            </option>
          ))}
        </select>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Vencimiento {planId ? "" : "(no aplica sin plan)"}
        </label>
        <input
          type="date"
          value={vencimiento}
          onChange={(e) => setVencimiento(e.target.value)}
          disabled={!planId}
          className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <p className="mb-4 text-[11px] text-slate-500">
          Para planes mensuales se sugiere 30 días desde hoy. Editalo si el cliente pagó otro período.
        </p>

        {err ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={busy || planes === null}
            className="rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3F8E91] disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}


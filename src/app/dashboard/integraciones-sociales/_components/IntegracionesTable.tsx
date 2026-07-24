"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Publicacion = {
  id: string;
  network: string;
  status: string;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  external_post_id: string | null;
  external_post_url: string | null;
  caption: string | null;
  published_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  inmueble_id: string;
  inmueble_titulo: string | null;
  inmueble_codigo: string | null;
  owner_type: "propietario" | "agente";
  owner_id: string;
  owner_nombre: string | null;
  owner_email: string | null;
  account_name: string | null;
  account_username: string | null;
};

type Counts = {
  pending: number;
  processing: number;
  published: number;
  failed: number;
  cuentas_conectadas: number;
  cuentas_expired: number;
};

type ListResp = { success: boolean; publicaciones: Publicacion[]; counts: Counts };

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s.slice(0, 16);
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending:    { bg: "#fef3c7", fg: "#92400e", label: "Pendiente" },
    processing: { bg: "#dbeafe", fg: "#1e40af", label: "Procesando" },
    published:  { bg: "#dcfce7", fg: "#166534", label: "Publicada" },
    failed:     { bg: "#fee2e2", fg: "#991b1b", label: "Fallida" },
    cancelled:  { bg: "#e5e7eb", fg: "#374151", label: "Cancelada" },
  };
  const s = map[status] || { bg: "#e5e7eb", fg: "#374151", label: status };
  return (
    <span style={{
      padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.fg,
    }}>{s.label}</span>
  );
}

function NetworkBadge({ network }: { network: string }) {
  if (network === "facebook") {
    return <span style={{ fontSize: 12 }}>📘 Facebook</span>;
  }
  if (network === "instagram") {
    return <span style={{ fontSize: 12 }}>📷 Instagram</span>;
  }
  return <span style={{ fontSize: 12 }}>{network}</span>;
}

export default function IntegracionesTable() {
  const [rows, setRows] = useState<Publicacion[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const [fNetwork, setFNetwork] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fDesde, setFDesde] = useState<string>("");
  const [fHasta, setFHasta] = useState<string>("");

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (fNetwork) q.set("network", fNetwork);
    if (fStatus) q.set("status", fStatus);
    if (fDesde) q.set("desde", fDesde);
    if (fHasta) q.set("hasta", fHasta);
    return q.toString();
  }, [fNetwork, fStatus, fDesde, fHasta]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = "/api/dashboard/integraciones-sociales" + (qs ? "?" + qs : "");
      const r = await fetchWithSupabaseSession(url);
      const b = (await r.json().catch(() => ({}))) as Partial<ListResp>;
      if (r.ok && b.success) {
        setRows(b.publicaciones ?? []);
        setCounts(b.counts ?? null);
      } else {
        setBanner({ kind: "err", text: "No se pudo cargar la lista." });
      }
    } catch {
      setBanner({ kind: "err", text: "Error de red al cargar." });
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { load(); }, [load]);

  async function retry(id: string) {
    setRetrying(id);
    setBanner(null);
    try {
      const r = await fetchWithSupabaseSession("/api/dashboard/integraciones-sociales/" + id + "/retry", { method: "POST" });
      const b = await r.json();
      if (!r.ok || !b?.success) {
        setBanner({ kind: "err", text: b?.error || "No se pudo reintentar." });
        return;
      }
      setBanner({ kind: "ok", text: "Job marcado como pendiente. Se reintentara en el proximo ciclo del worker." });
      await load();
    } catch {
      setBanner({ kind: "err", text: "Error de red al reintentar." });
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div>
      {counts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          <StatCard label="Pendientes" value={counts.pending} color="#92400e" bg="#fef3c7" />
          <StatCard label="Procesando" value={counts.processing} color="#1e40af" bg="#dbeafe" />
          <StatCard label="Publicadas" value={counts.published} color="#166534" bg="#dcfce7" />
          <StatCard label="Fallidas" value={counts.failed} color="#991b1b" bg="#fee2e2" />
          <StatCard label="Cuentas conectadas" value={counts.cuentas_conectadas} color="#166534" bg="#dcfce7" />
          <StatCard label="Cuentas caidas" value={counts.cuentas_expired} color="#991b1b" bg="#fee2e2" />
        </div>
      )}

      {banner && (
        <div style={{
          padding: 12, marginBottom: 14, borderRadius: 8,
          background: banner.kind === "ok" ? "#dcfce7" : "#fee2e2",
          color: banner.kind === "ok" ? "#166534" : "#991b1b",
          fontSize: 13,
        }}>
          {banner.text}
          <button onClick={() => setBanner(null)} style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer" }}>x</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
        <FilterField label="Red">
          <select value={fNetwork} onChange={(e) => setFNetwork(e.target.value)}>
            <option value="">Todas</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </FilterField>
        <FilterField label="Estado">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="processing">Procesando</option>
            <option value="published">Publicada</option>
            <option value="failed">Fallida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </FilterField>
        <FilterField label="Desde">
          <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} />
        </FilterField>
        <FilterField label="Hasta">
          <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} />
        </FilterField>
        <button
          onClick={() => { setFNetwork(""); setFStatus(""); setFDesde(""); setFHasta(""); }}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        >
          Limpiar
        </button>
        <button
          onClick={() => load()}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Actualizar
        </button>
      </div>

      {loading && <div style={{ padding: 20, textAlign: "center", color: "#64748b" }}>Cargando...</div>}
      {!loading && rows.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b", background: "#f8fafc", borderRadius: 8 }}>
          No hay publicaciones que coincidan con los filtros.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                <Th>Owner</Th>
                <Th>Inmueble</Th>
                <Th>Red</Th>
                <Th>Cuenta</Th>
                <Th>Estado</Th>
                <Th>Intentos</Th>
                <Th>Fecha</Th>
                <Th>Error</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <TableRow key={r.id} r={r} retrying={retrying === r.id} onRetry={retry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TableRow({ r, retrying, onRetry }: { r: Publicacion; retrying: boolean; onRetry: (id: string) => void }) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      <Td>
        <div style={{ fontWeight: 600 }}>{r.owner_nombre || "-"}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>
          {r.owner_type === "agente" ? "Agente" : "Propietario"}{r.owner_email ? " - " + r.owner_email : ""}
        </div>
      </Td>
      <Td>
        <div style={{ fontWeight: 500 }}>{r.inmueble_titulo || "-"}</div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{r.inmueble_codigo || r.inmueble_id.slice(0, 8)}</div>
      </Td>
      <Td><NetworkBadge network={r.network} /></Td>
      <Td>
        <div style={{ fontSize: 12 }}>{r.account_name || "-"}</div>
        {r.account_username && <div style={{ fontSize: 11, color: "#64748b" }}>@{r.account_username}</div>}
      </Td>
      <Td><StatusBadge status={r.status} /></Td>
      <Td style={{ textAlign: "center" }}>{r.attempt_count}</Td>
      <Td style={{ fontSize: 11, color: "#475569" }}>
        <div>Creado: {fmtDate(r.created_at)}</div>
        {r.published_at && <div>Publicado: {fmtDate(r.published_at)}</div>}
        {r.next_retry_at && r.status === "pending" && <div>Retry: {fmtDate(r.next_retry_at)}</div>}
      </Td>
      <Td style={{ fontSize: 11, maxWidth: 280 }}>
        {r.last_error_code && <div style={{ fontWeight: 600, color: "#991b1b" }}>{r.last_error_code}</div>}
        {r.last_error_message && <div style={{ color: "#64748b" }}>{r.last_error_message.slice(0, 140)}</div>}
      </Td>
      <Td>
        <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
          {r.external_post_url && (
            <a href={r.external_post_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Ver post
            </a>
          )}
          {(r.status === "failed" || r.status === "pending") && (
            <button
              onClick={() => onRetry(r.id)}
              disabled={retrying}
              className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
            >
              {retrying ? "..." : "Reintentar"}
            </button>
          )}
        </div>
      </Td>
    </tr>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 10, background: bg }}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 12px", verticalAlign: "top", ...style }}>{children}</td>;
}

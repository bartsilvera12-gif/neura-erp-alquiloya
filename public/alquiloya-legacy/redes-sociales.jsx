// Panel del propietario: conectar/desconectar Facebook e Instagram (Meta).
// Los access tokens JAMAS pasan por aqui — la API solo devuelve metadata.

function RedesSocialesPanel({ onNav }) {
  const [loading, setLoading] = React.useState(true);
  const [conexiones, setConexiones] = React.useState([]);
  const [pending, setPending] = React.useState(null);
  const [selecting, setSelecting] = React.useState(null);
  const [banner, setBanner] = React.useState(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const rStatus = await fetch("/api/integraciones/meta/status", { credentials: "include" });
      const rPending = await fetch("/api/integraciones/meta/pending", { credentials: "include" });
      const bStatus = rStatus.ok ? await rStatus.json() : { conexiones: [] };
      const bPending = rPending.ok ? await rPending.json() : { pending: null };
      setConexiones(bStatus?.conexiones || []);
      setPending(bPending?.pending || null);
    } catch (e) {
      setBanner({ kind: "err", text: "No se pudo cargar el estado. Reintenta." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(function () { reload(); }, [reload]);

  React.useEffect(function () {
    try {
      const hashQuery = window.location.hash.split("?")[1] || "";
      const q = new URLSearchParams(hashQuery);
      if (q.has("meta_error")) {
        setBanner({ kind: "err", text: "Meta: " + (q.get("meta_error") || "error desconocido") });
        history.replaceState(null, "", "#admin-agent-redes");
      } else if (q.has("meta_select")) {
        setBanner({ kind: "ok", text: "Autorizacion recibida. Elegi la pagina que queres usar." });
        history.replaceState(null, "", "#admin-agent-redes");
      }
    } catch (e) { /* noop */ }
  }, []);

  async function iniciarConexion() {
    setBanner(null);
    try {
      const r = await fetch("/api/integraciones/meta/oauth/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const b = await r.json();
      if (!r.ok || !b?.authorize_url) {
        setBanner({ kind: "err", text: b?.error || "No se pudo iniciar la conexion." });
        return;
      }
      window.location.href = b.authorize_url;
    } catch (e) {
      setBanner({ kind: "err", text: "Error de red al iniciar la conexion." });
    }
  }

  async function seleccionarPagina(page_id, use_instagram) {
    setSelecting(page_id);
    setBanner(null);
    try {
      const r = await fetch("/api/integraciones/meta/select-page", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id: page_id, use_instagram: !!use_instagram }),
      });
      const b = await r.json();
      if (!r.ok || !b?.success) {
        setBanner({ kind: "err", text: b?.error || "No se pudo guardar la seleccion." });
        return;
      }
      setBanner({ kind: "ok", text: "Cuenta conectada." });
      await reload();
    } catch (e) {
      setBanner({ kind: "err", text: "Error de red al guardar." });
    } finally {
      setSelecting(null);
    }
  }

  async function toggleAuto(conexion_id, network, enabled) {
    setConexiones(function (prev) {
      return prev.map(function (c) {
        if (c.id !== conexion_id) return c;
        return Object.assign({}, c, {
          auto_publish_facebook: network === "facebook" ? enabled : c.auto_publish_facebook,
          auto_publish_instagram: network === "instagram" ? enabled : c.auto_publish_instagram,
        });
      });
    });
    try {
      const r = await fetch("/api/integraciones/meta/toggle-auto", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conexion_id: conexion_id, network: network, enabled: enabled }),
      });
      if (!r.ok) {
        setBanner({ kind: "err", text: "No se pudo actualizar el switch." });
        await reload();
      }
    } catch (e) {
      setBanner({ kind: "err", text: "Error de red al actualizar switch." });
      await reload();
    }
  }

  async function desconectar(conexion_id) {
    if (!window.confirm("Desconectar esta cuenta? No se van a poder publicar nuevos inmuebles hasta reconectar.")) return;
    setBanner(null);
    try {
      const r = await fetch("/api/integraciones/meta/disconnect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conexion_id: conexion_id }),
      });
      const b = await r.json();
      if (!r.ok || !b?.success) {
        setBanner({ kind: "err", text: b?.error || "No se pudo desconectar." });
        return;
      }
      setBanner({ kind: "ok", text: "Cuenta desconectada." });
      await reload();
    } catch (e) {
      setBanner({ kind: "err", text: "Error de red al desconectar." });
    }
  }

  const conexionesActivas = conexiones.filter(function (c) { return c.status === "connected"; });
  const conexionesInactivas = conexiones.filter(function (c) { return c.status !== "connected"; });

  return (
    <div style={{ padding: "0 4px" }}>
      {banner && (
        <div className="card" style={{
          padding: 14, marginBottom: 16,
          background: banner.kind === "ok" ? "#e6f6ec" : "#fdecec",
          borderLeft: "4px solid " + (banner.kind === "ok" ? "#16a34a" : "#d93838"),
        }}>
          <div className="row between" style={{ alignItems: "center" }}>
            <span style={{ fontSize: 13.5 }}>{banner.text}</span>
            <button onClick={function () { setBanner(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)" }}>x</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontFamily: "Montserrat", fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
          Redes sociales conectadas
        </div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Conecta una Pagina de Facebook y/o una cuenta profesional de Instagram
          para que tus publicaciones aparezcan automaticamente cuando se aprueben.
          El inmueble se publica en AlquiloYa aunque la red social presente un error.
        </div>
      </div>

      {loading && (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--ink-3)" }}>
          Cargando...
        </div>
      )}

      {!loading && pending && Array.isArray(pending.pages) && pending.pages.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16, borderLeft: "4px solid var(--blue)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            Autorizacion de Meta recibida
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Elegi que pagina queres usar para publicar. Si tu cuenta de Instagram
            esta vinculada, podes activarla en el mismo paso.
          </div>
          <div className="col gap-10">
            {pending.pages.map(function (p) {
              return (
                <PageOption
                  key={p.id}
                  page={p}
                  selecting={selecting === p.id}
                  onSelect={function (useIg) { seleccionarPagina(p.id, useIg); }}
                />
              );
            })}
          </div>
        </div>
      )}

      {!loading && conexionesActivas.length === 0 && !pending && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>
            Todavia no tenes cuentas conectadas.
          </div>
          <button className="btn btn-blue" onClick={iniciarConexion} style={{ padding: "10px 22px" }}>
            Conectar cuenta de Facebook / Instagram
          </button>
        </div>
      )}

      {!loading && conexionesActivas.length > 0 && (
        <div className="col gap-10">
          {conexionesActivas.map(function (c) {
            return (
              <ConexionCard
                key={c.id}
                c={c}
                onToggle={toggleAuto}
                onDisconnect={function () { desconectar(c.id); }}
                onReconnect={iniciarConexion}
              />
            );
          })}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={iniciarConexion}>
              + Conectar otra cuenta
            </button>
          </div>
        </div>
      )}

      {!loading && conexionesInactivas.length > 0 && (
        <details style={{ marginTop: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--ink-3)" }}>
            {conexionesInactivas.length} conexion(es) inactivas
          </summary>
          <div className="col gap-8" style={{ marginTop: 10 }}>
            {conexionesInactivas.map(function (c) {
              return (
                <div key={c.id} className="card" style={{ padding: 12, opacity: 0.7 }}>
                  <div className="row between">
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.account_name || "-"}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function PageOption({ page, selecting, onSelect }) {
  const [useIg, setUseIg] = React.useState(!!page.has_instagram);
  return (
    <div className="card" style={{ padding: 14, background: "var(--bg-2)" }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{page.name || "Sin nombre"}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>Pagina de Facebook</div>
          {page.has_instagram && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5 }}>
              <input
                type="checkbox"
                checked={useIg}
                onChange={function (e) { setUseIg(e.target.checked); }}
                style={{ width: 15, height: 15, accentColor: "var(--blue)" }}
              />
              <span>Publicar tambien en Instagram (@{page.instagram_username || "-"})</span>
            </label>
          )}
          {!page.has_instagram && (
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
              Esta pagina no tiene una cuenta de Instagram Business vinculada.
            </div>
          )}
        </div>
        <button
          className="btn btn-blue btn-sm"
          disabled={selecting}
          onClick={function () { onSelect(useIg); }}
          style={{ marginLeft: 12, whiteSpace: "nowrap" }}
        >
          {selecting ? "Guardando..." : "Usar esta cuenta"}
        </button>
      </div>
    </div>
  );
}

function ConexionCard({ c, onToggle, onDisconnect, onReconnect }) {
  const hasIg = !!c.instagram_account_id;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{c.account_name || "Cuenta Meta"}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Facebook - Pagina #{(c.facebook_page_id || "").slice(-6) || "-"}
            {hasIg && (
              <span>&nbsp;-&nbsp;Instagram @{c.username || (c.instagram_account_id || "").slice(-6)}</span>
            )}
          </div>
          <div style={{ display: "inline-flex", gap: 6, marginTop: 8 }}>
            <span style={{
              padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
              background: "#e6f6ec", color: "#16a34a",
            }}>CONECTADO</span>
          </div>
        </div>
        <div className="col gap-6" style={{ minWidth: 130, alignItems: "stretch" }}>
          <button className="btn btn-outline btn-sm" onClick={onReconnect}>Reconectar</button>
          <button className="btn btn-sm" onClick={onDisconnect} style={{
            background: "#fff", color: "#d93838", border: "1px solid #f1c4c4",
          }}>Desconectar</button>
        </div>
      </div>
      <div className="row gap-16" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-2)" }}>
        <SwitchRow
          label="Publicar automaticamente en Facebook"
          checked={!!c.auto_publish_facebook}
          onChange={function (v) { onToggle(c.id, "facebook", v); }}
        />
        {hasIg && (
          <SwitchRow
            label="Publicar automaticamente en Instagram"
            checked={!!c.auto_publish_instagram}
            onChange={function (v) { onToggle(c.id, "instagram", v); }}
          />
        )}
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={function (e) { onChange(e.target.checked); }}
        style={{ width: 16, height: 16, accentColor: "var(--blue)", cursor: "pointer" }}
      />
      <span>{label}</span>
    </label>
  );
}

Object.assign(window, { RedesSocialesPanel });

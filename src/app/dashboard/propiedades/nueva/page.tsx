"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import MapPicker from "@/components/MapPicker";

type Agente = { id: string; nombre: string };
type Propietario = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  telefono_contacto: string | null;
  documento: string | null;
  observaciones: string | null;
};
type Foto = { url: string; alt: string; es_portada: boolean };
type Caracteristica = { nombre: string; valor: string };

const TIPOS = ["departamento", "casa", "duplex", "terreno", "local_comercial", "oficina", "deposito"];
const OPERACIONES = ["alquiler", "venta", "alquiler_temporal"];
const ESTADOS = ["disponible", "reservado", "alquilado", "vendido", "pausada"];
const MONEDAS = ["PYG", "USD"];

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/30";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-slate-600";
const fieldCls = "space-y-1.5";

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [propietarios, setPropietarios] = useState<Propietario[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    titulo: "",
    tipo: TIPOS[0],
    operacion: OPERACIONES[0],
    estado: ESTADOS[0],
    ciudad: "",
    barrio: "",
    direccion: "",
    descripcion: "",
    precio: "",
    moneda: "PYG",
    dormitorios: "",
    banos: "",
    cocheras: "",
    superficie_m2: "",
    terreno_m2: "",
    codigo: "",
    agente_id: "",
    activo: true,
    visible_web: true,
    destacada: false,
    propietario_id: "",
    propietario_nombre: "",
    propietario_email: "",
    propietario_telefono: "",
    propietario_telefono_contacto: "",
    propietario_documento: "",
    propietario_observaciones: "",
    lat: null as number | null,
    lng: null as number | null,
  });
  const [fotos, setFotos] = useState<Foto[]>([{ url: "", alt: "", es_portada: true }]);
  const [cars, setCars] = useState<Caracteristica[]>([{ nombre: "", valor: "" }]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/public/alquiloya/agentes", { cache: "no-store" });
        const body = (await res.json()) as { success?: boolean; data?: { agentes?: Agente[] } };
        if (body?.success && body.data?.agentes) setAgentes(body.data.agentes);
      } catch {
        /* ignorar */
      }
    (async () => {
      try {
        const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-propietarios?limit=200", { cache: "no-store" });
        const body = (await res.json()) as { success?: boolean; data?: { propietarios?: Propietario[] } };
        if (body?.success && body.data?.propietarios) setPropietarios(body.data.propietarios);
      } catch {
        /* ignorar */
      }
    })();
    })();
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.titulo.trim()) { setErr("El título es obligatorio"); return; }
    if (!form.tipo.trim()) { setErr("El tipo es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        agente_id: form.agente_id || null,
        propietario_id: form.propietario_id || null,
        propietario_nombre: form.propietario_nombre.trim() || null,
        propietario_email: form.propietario_email.trim() || null,
        propietario_telefono: form.propietario_telefono.trim() || null,
        propietario_telefono_contacto: form.propietario_telefono_contacto.trim() || null,
        propietario_documento: form.propietario_documento.trim() || null,
        propietario_observaciones: form.propietario_observaciones.trim() || null,
        precio: form.precio || null,
        dormitorios: form.dormitorios || null,
        banos: form.banos || null,
        cocheras: form.cocheras || null,
        superficie_m2: form.superficie_m2 || null,
        terreno_m2: form.terreno_m2 || null,
        codigo: form.codigo || null,
        fotos: fotos.filter((f) => f.url.trim()),
        caracteristicas: cars.filter((c) => c.nombre.trim()),
      };
      const res = await fetchWithSupabaseSession("/api/dashboard/alquiloya-propiedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; id?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/dashboard/propiedades/${data.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <header className="mb-6">
        <Link href="/dashboard/propiedades" className="mb-2 inline-flex text-xs font-medium text-slate-500 hover:text-[#3F8E91]">
          ← Volver al listado
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nueva propiedad</h1>
        <p className="mt-1 text-sm text-slate-500">Carga inicial — luego podrás editar fotos y características.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        {err ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>
        ) : null}

        {/* Datos generales */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos generales</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={fieldCls}>
              <label className={labelCls}>Título *</label>
              <input className={inputCls} value={form.titulo} onChange={(e) => set("titulo", e.target.value)} required />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Código interno</label>
              <input className={inputCls} value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="opcional" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Tipo *</label>
              <select className={inputCls} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Operación</label>
              <select className={inputCls} value={form.operacion} onChange={(e) => set("operacion", e.target.value)}>
                {OPERACIONES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                {ESTADOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Agente</label>
              <select className={inputCls} value={form.agente_id} onChange={(e) => set("agente_id", e.target.value)}>
                <option value="">— Sin asignar —</option>
                {agentes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className={`${fieldCls} sm:col-span-2`}>
              <label className={labelCls}>Descripción</label>
              <textarea rows={12} className={`${inputCls} min-h-[260px] leading-relaxed`} value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} />
            </div>
          </div>
        </section>

        {/* Ubicación */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Ubicación</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={fieldCls}>
              <label className={labelCls}>Ciudad</label>
              <input className={inputCls} value={form.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Barrio</label>
              <input className={inputCls} value={form.barrio} onChange={(e) => set("barrio", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Dirección</label>
              <input className={inputCls} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
            </div>
          </div>
          <div className="mt-5">
            <label className={labelCls}>Punto en el mapa</label>
            <p className="mb-2 text-[11px] text-slate-500">Clic en el mapa para fijar la ubicación. Podés arrastrar el pin.</p>
            <MapPicker
              value={{ lat: form.lat, lng: form.lng }}
              onChange={(v) => setForm((f) => ({ ...f, lat: v.lat, lng: v.lng }))}
            />
          </div>
        </section>

        {/* Precio + características numéricas */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600">Precio y dimensiones</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className={fieldCls}>
              <label className={labelCls}>Precio</label>
              <input className={inputCls} type="number" min="0" value={form.precio} onChange={(e) => set("precio", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Moneda</label>
              <select className={inputCls} value={form.moneda} onChange={(e) => set("moneda", e.target.value)}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Dormitorios</label>
              <input className={inputCls} type="number" min="0" value={form.dormitorios} onChange={(e) => set("dormitorios", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Baños</label>
              <input className={inputCls} type="number" min="0" value={form.banos} onChange={(e) => set("banos", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Cocheras</label>
              <input className={inputCls} type="number" min="0" value={form.cocheras} onChange={(e) => set("cocheras", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Superficie m²</label>
              <input className={inputCls} type="number" min="0" value={form.superficie_m2} onChange={(e) => set("superficie_m2", e.target.value)} />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Terreno m²</label>
              <input className={inputCls} type="number" min="0" value={form.terreno_m2} onChange={(e) => set("terreno_m2", e.target.value)} />
            </div>
          </div>
        </section>

        {/* Fotos */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Fotos por URL</h2>
            <button type="button" onClick={() => setFotos((arr) => [...arr, { url: "", alt: "", es_portada: false }])}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              + Agregar
            </button>
          </div>
          <div className="space-y-3">
            {fotos.map((f, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_auto_auto]">
                <input className={inputCls} placeholder="https://..." value={f.url} onChange={(e) => setFotos((arr) => arr.map((x, i) => i === idx ? { ...x, url: e.target.value } : x))} />
                <input className={inputCls} placeholder="Texto alternativo" value={f.alt} onChange={(e) => setFotos((arr) => arr.map((x, i) => i === idx ? { ...x, alt: e.target.value } : x))} />
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input type="radio" name="portada" checked={f.es_portada} onChange={() => setFotos((arr) => arr.map((x, i) => ({ ...x, es_portada: i === idx })))} />
                  Portada
                </label>
                <button type="button" onClick={() => setFotos((arr) => arr.filter((_, i) => i !== idx))} className="rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Características */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">Características</h2>
            <button type="button" onClick={() => setCars((arr) => [...arr, { nombre: "", valor: "" }])}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              + Agregar
            </button>
          </div>
          <div className="space-y-3">
            {cars.map((c, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input className={inputCls} placeholder="Nombre (ej. Pileta)" value={c.nombre} onChange={(e) => setCars((arr) => arr.map((x, i) => i === idx ? { ...x, nombre: e.target.value } : x))} />
                <input className={inputCls} placeholder="Valor (opcional)" value={c.valor} onChange={(e) => setCars((arr) => arr.map((x, i) => i === idx ? { ...x, valor: e.target.value } : x))} />
                <button type="button" onClick={() => setCars((arr) => arr.filter((_, i) => i !== idx))} className="rounded-lg border border-rose-200 px-2 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </section>


        {/* Datos del propietario */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Datos del propietario</h2>
          <p className="mb-4 text-xs text-slate-500">
            Si el propietario ya cargó esta propiedad desde la web o tiene cuenta, elegilo del selector. Si no, completá los datos abajo y el sistema lo crea o lo vincula automáticamente por email/teléfono.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={`${fieldCls} sm:col-span-2`}>
              <label className={labelCls}>Propietario existente</label>
              <select
                className={inputCls}
                value={form.propietario_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const pr = propietarios.find((p) => p.id === id);
                  setForm((f) => ({
                    ...f,
                    propietario_id: id,
                    propietario_nombre: pr?.nombre ?? f.propietario_nombre,
                    propietario_email: pr?.email ?? f.propietario_email,
                    propietario_telefono: pr?.telefono ?? f.propietario_telefono,
                    propietario_telefono_contacto: pr?.telefono_contacto ?? f.propietario_telefono_contacto,
                    propietario_documento: pr?.documento ?? f.propietario_documento,
                    propietario_observaciones: pr?.observaciones ?? f.propietario_observaciones,
                  }));
                }}
              >
                <option value="">— Cargar propietario nuevo —</option>
                {propietarios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                    {p.email ? ` · ${p.email}` : ""}
                    {p.telefono ? ` · ${p.telefono}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Nombre</label>
              <input className={inputCls} value={form.propietario_nombre} onChange={(e) => set("propietario_nombre", e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Documento (CI / RUC)</label>
              <input className={inputCls} value={form.propietario_documento} onChange={(e) => set("propietario_documento", e.target.value)} placeholder="opcional" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.propietario_email} onChange={(e) => set("propietario_email", e.target.value)} placeholder="propietario@email.com" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Teléfono</label>
              <input className={inputCls} value={form.propietario_telefono} onChange={(e) => set("propietario_telefono", e.target.value)} placeholder="+595…" />
            </div>
            <div className={fieldCls}>
              <label className={labelCls}>Teléfono de contacto (WhatsApp público)</label>
              <input className={inputCls} value={form.propietario_telefono_contacto} onChange={(e) => set("propietario_telefono_contacto", e.target.value)} placeholder="opcional, si difiere del de arriba" />
            </div>
            <div className={`${fieldCls} sm:col-span-2`}>
              <label className={labelCls}>Observaciones</label>
              <textarea rows={2} className={inputCls} value={form.propietario_observaciones} onChange={(e) => set("propietario_observaciones", e.target.value)} placeholder="Notas internas sobre el propietario (no se muestran en la web)" />
            </div>
          </div>
        </section>
        {/* Flags publicación */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">Publicación</h2>
          <div className="flex flex-wrap gap-5">
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Activo
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.visible_web} onChange={(e) => set("visible_web", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Publicado en la web
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-800">
              <input type="checkbox" checked={form.destacada} onChange={(e) => set("destacada", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#4FAEB2] focus:ring-[#4FAEB2]" />
              Destacada
            </label>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Link href="/dashboard/propiedades" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancelar
          </Link>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar propiedad"}
          </button>
        </div>
      </form>
    </div>
  );
}

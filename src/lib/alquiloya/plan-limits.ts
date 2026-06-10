// Extrae limites cuantitativos de los bullets textuales de planes_publicacion.
// Los bullets son strings tipo "15 propiedades activas" o "Hasta 10 fotos por inmueble".
// No tenemos columnas dedicadas para los limites — los inferimos del texto para
// que admin pueda editarlos sin migracion.

export type PlanLimits = {
  propiedadesActivas: number | null; // null = ilimitado / no detectable
  fotosPorInmueble: number | null;
};

const PROP_RE = /(\d+)\s*propiedades?\s+activas?/i;
const FOTOS_RE = /hasta\s+(\d+)\s+fotos?/i;

export function extractPlanLimits(bullets: unknown): PlanLimits {
  const arr = Array.isArray(bullets) ? bullets : [];
  let propiedadesActivas: number | null = null;
  let fotosPorInmueble: number | null = null;
  for (const b of arr) {
    if (typeof b !== "string") continue;
    if (propiedadesActivas == null) {
      const m = b.match(PROP_RE);
      if (m) propiedadesActivas = Number(m[1]) || null;
    }
    if (fotosPorInmueble == null) {
      const m = b.match(FOTOS_RE);
      if (m) fotosPorInmueble = Number(m[1]) || null;
    }
  }
  return { propiedadesActivas, fotosPorInmueble };
}

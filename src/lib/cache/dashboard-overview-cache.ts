// Cache compartido del dashboard overview. Se mantiene en su propio modulo
// para que rutas que mutan datos (moderacion, etc.) puedan invalidarlo sin
// importar del route handler.
export type CachedOverview = { data: unknown; computedAt: number; refreshing: boolean };

export const overviewResponseCache = new Map<string, CachedOverview>();

export function overviewCacheKey(schema: string, empresaId: string): string {
  return `${schema}:${empresaId}`;
}

/** Invalida el cache para un tenant especifico (schema + empresa_id). */
export function bustOverviewCache(schema: string, empresaId: string): void {
  overviewResponseCache.delete(overviewCacheKey(schema, empresaId));
}

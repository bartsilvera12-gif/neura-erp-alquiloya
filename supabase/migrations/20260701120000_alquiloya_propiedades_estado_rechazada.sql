-- =============================================================================
-- AlquiloYa · permite estado='rechazada' en propiedades
-- Cola de moderacion: al rechazar una propiedad desde
-- /dashboard/propiedades-pendientes la setea en 'rechazada'.
-- Idempotente: dropea el constraint si existe y lo recrea con la nueva lista.
-- =============================================================================

DO $$
BEGIN
  -- 1) Quitar el constraint actual (si existe) sea cual sea su nombre exacto.
  PERFORM 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'alquiloya'
     AND t.relname = 'propiedades'
     AND c.conname = 'propiedades_estado_check';
  IF FOUND THEN
    EXECUTE 'ALTER TABLE alquiloya.propiedades DROP CONSTRAINT propiedades_estado_check';
  END IF;
END $$;

ALTER TABLE alquiloya.propiedades
  ADD CONSTRAINT propiedades_estado_check
  CHECK (
    estado IS NULL OR estado IN (
      'disponible',
      'reservado',
      'alquilado',
      'vendido',
      'pausada',
      'inactiva',
      'rechazada',
      'cerrado',
      'cerrada',
      'finalizado'
    )
  );

SELECT pg_notify('pgrst', 'reload schema');

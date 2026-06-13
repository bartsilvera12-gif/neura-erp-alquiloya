-- =============================================================================
-- AlquiloYa · permite estado='eliminada' en propiedades + backfill
--
-- Motivo: el soft-delete del dueño (DELETE en /api/public/alquiloya/
-- propiedades/[id]) seteaba activo=false + visible_web=false sin tocar
-- estado. Como el query de "Pendientes de aprobacion" matchea por
-- (estado IS NULL OR estado IN ('inactiva')), las propiedades borradas
-- desde el front quedaban contandose como pendientes.
--
-- Fix: distinguirlas con estado='eliminada'. El query de pendientes
-- ya las excluye (no esta en su lista). Idempotente.
--
-- 1) Permitir el nuevo estado en el CHECK.
-- 2) Backfill: para propiedades que YA fueron soft-deleted antes de este
--    fix (activo=false AND visible_web=false AND estado='inactiva' AND
--    fueron updated_at > created_at, es decir, modificadas despues de
--    creadas y todavia siguen "pending"), las marcamos como eliminada.
--    Heuristica: si el wizard publico las inserto y nunca nadie las
--    aprobo/rechazo, updated_at == created_at; si alguien las soft-deleto,
--    updated_at > created_at por varios segundos.
-- =============================================================================

DO $$
BEGIN
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
      'finalizado',
      'eliminada'
    )
  );

-- Backfill de phantom-pendientes: las que fueron borradas con el codigo
-- viejo y quedaron como activo=false, visible_web=false, estado='inactiva'
-- pero con updated_at > created_at + 5s las marcamos como eliminada.
UPDATE alquiloya.propiedades
   SET estado = 'eliminada',
       updated_at = now()
 WHERE activo = false
   AND visible_web = false
   AND estado = 'inactiva'
   AND updated_at > created_at + interval '5 seconds';

SELECT pg_notify('pgrst', 'reload schema');

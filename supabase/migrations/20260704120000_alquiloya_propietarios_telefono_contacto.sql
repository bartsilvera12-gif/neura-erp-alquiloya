-- =============================================================================
-- AlquiloYa · propietarios.telefono_contacto
-- Agrega un segundo numero al propietario: el "telefono" original sigue
-- siendo su contacto personal (uso interno admin), y "telefono_contacto" es
-- el numero PUBLICO que aparece en la ficha de la propiedad y dispara el
-- boton "Consultar por WhatsApp". Si telefono_contacto es NULL, el listing
-- cae al telefono personal (compat con propietarios viejos).
--
-- Idempotente (IF NOT EXISTS).
-- =============================================================================

ALTER TABLE alquiloya.propietarios
  ADD COLUMN IF NOT EXISTS telefono_contacto text;

-- ============================================================================
-- Migracion: campos nuevos para Inventario de Telas
-- ----------------------------------------------------------------------------
-- Agrega los campos de identificacion/clasificacion de telas y los campos
-- de cantidad por unidad en los movimientos. Es idempotente: se puede correr
-- varias veces sin error gracias a IF NOT EXISTS.
-- ============================================================================

-- 1. inventario_telas: nuevos atributos de referencia
ALTER TABLE telas.inventario_telas
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS proveedor text,
  ADD COLUMN IF NOT EXISTS referencia_cliente text,
  ADD COLUMN IF NOT EXISTS ancho_pulgadas numeric(6, 2);

-- Migrar el ancho previo (en metros) a pulgadas si existia la columna `ancho`
-- y aun no se ha poblado ancho_pulgadas. 1 metro = 39.3701 pulgadas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telas'
      AND table_name = 'inventario_telas'
      AND column_name = 'ancho'
  ) THEN
    UPDATE telas.inventario_telas
    SET ancho_pulgadas = ROUND((ancho * 39.3701)::numeric, 2)
    WHERE ancho_pulgadas IS NULL AND ancho IS NOT NULL;
  END IF;
END $$;

-- 2. inventario_movimientos: cantidad desglosada por unidad
ALTER TABLE telas.inventario_movimientos
  ADD COLUMN IF NOT EXISTS cantidad_metros numeric(10, 2),
  ADD COLUMN IF NOT EXISTS cantidad_yardas numeric(10, 2);

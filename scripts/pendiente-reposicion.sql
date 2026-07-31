-- =====================================================================
-- Estado "Pendiente por Reposición" — bandera manual por orden
-- ---------------------------------------------------------------------
-- Marca manual (además del estado derivado de telas.incidencias con
-- estado_reposicion='Pendiente'). Indica que la orden no puede terminar
-- su proceso actual porque espera una reposición de `area_reposicion`.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

alter table telas.cabecera add column if not exists pendiente_reposicion boolean default false;
alter table telas.cabecera add column if not exists area_reposicion text;
alter table telas.cabecera add column if not exists fecha_pendiente_reposicion timestamptz;

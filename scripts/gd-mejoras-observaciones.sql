-- =====================================================================
-- GD: mejoras solicitadas por el usuario final (observaciones)
-- ---------------------------------------------------------------------
-- Nuevas columnas para:
--  1. Existente: pregunta "¿lleva cambios?" (existente_lleva_cambios)
--  3. Recreación: toggles SÍ/NO por sección + uploader de texturas
--  5. Cliente adjunta imágenes en su revisión (imagenes_cliente_urls)
--  6. Ventas sube nuevo logo pedido por el cliente (logos_nuevos_urls)
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- gestion_disenos
alter table telas.gestion_disenos add column if not exists existente_lleva_cambios boolean;
alter table telas.gestion_disenos add column if not exists recreacion_colores boolean default false;
alter table telas.gestion_disenos add column if not exists recreacion_imagenes boolean default false;
alter table telas.gestion_disenos add column if not exists recreacion_texturas boolean default false;
alter table telas.gestion_disenos add column if not exists urls_texturas text[];

-- gestion_disenos_propuestas
alter table telas.gestion_disenos_propuestas add column if not exists imagenes_cliente_urls text[];
alter table telas.gestion_disenos_propuestas add column if not exists logos_nuevos_urls text[];

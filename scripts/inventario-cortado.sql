-- =====================================================================
-- Inventario Cortado — la orden entra con las piezas ya cortadas
-- ---------------------------------------------------------------------
-- Se marca al aprobar, junto a "Es Marker Digital". Significa que las
-- piezas ya existen cortadas en inventario, así que la orden NO pasa por
-- Marker ni por Corte: entra directo a Costura.
--
-- Es una bandera de flujo, del mismo tipo que `omite_corte_costura` o
-- `solo_corte_costura`. La diferencia con esas dos:
--
--   * solo_corte_costura   → salta Diseño/Impresión/Sublimación, SÍ corta.
--   * omite_corte_costura  → salta Corte Y Costura.
--   * inventario_cortado   → salta Marker y Corte, pero SÍ cose.
--
-- Al saltarse esas dos áreas, la orden tampoco recibe sus fechas
-- objetivo: si las recibiera, quedarían vencidas para siempre en
-- Capacidad y Adherencia, que es justo el problema que ya se corrigió
-- para los otros flujos reducidos.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table telas.cabecera
  add column if not exists inventario_cortado_si_no boolean not null default false;

comment on column telas.cabecera.inventario_cortado_si_no is
  'La orden usa piezas ya cortadas de inventario: no pasa por Marker ni '
  'por Corte, entra directo a Costura. Se marca al aprobar.';


-- ---------------------------------------------------------------------
-- Vistas: las dos áreas que se saltan deben reportar 'N/A'
-- ---------------------------------------------------------------------
-- Sin esto, el pipeline del Dashboard mostraría estas órdenes como
-- "Pendiente" en Marker y en Corte para siempre, anunciando un paso que
-- nunca va a ocurrir.
--
-- OJO: vista_control_produccion se recrea completa porque
-- `create or replace view` no permite cambiar una columna en medio
-- (error 42P16). El resto del DDL se conserva literal; lo único que
-- cambia son las dos ramas que agregan `inventario_cortado_si_no`.
--
-- Se asume que ya se ejecutó `marker-vistas.sql`. Si no, córrelo antes:
-- este script parte de esa definición.
-- ---------------------------------------------------------------------

-- Nota de aplicación: el bloque de abajo NO se incluye aquí para no
-- duplicar 140 líneas de DDL que ya viven en marker-vistas.sql y que se
-- desincronizarían al primer cambio. En su lugar, edita ese archivo
-- añadiendo estas dos condiciones y vuelve a ejecutarlo:
--
--   status_marker  → agregar, tras la línea de omite_corte_costura:
--       when inventario_cortado_si_no = true then 'N/A'::text
--
--   status_corte   → agregar, tras la línea de omite_corte_costura:
--       when inventario_cortado_si_no = true then 'N/A'::text
--
-- Ambas van ANTES de la rama que evalúa las fechas, para que una orden
-- de inventario cortado no aparezca como Terminado/Recibido por datos
-- viejos.


-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
-- 1) La columna existe y arranca en false para todas:
-- select count(*) as total,
--        count(*) filter (where inventario_cortado_si_no) as marcadas
--   from telas.cabecera;
--
-- 2) Ninguna orden debería tener las dos banderas a la vez: si usa
--    piezas ya cortadas, no tiene sentido que además pida trazo.
-- select pedido from telas.cabecera
--  where inventario_cortado_si_no = true
--    and es_marker_digital_si_no = true;

-- =====================================================================
-- Tendidos: la subdivisión de un marker
-- ---------------------------------------------------------------------
-- Un marker no se corta de una sola vez. Se parte en TENDIDOS, y cada
-- uno es un trazo concreto: su tela, su talla, su género, su color, su
-- longitud, sus capas y las piezas que salen. La hoja de corte en papel
-- ya trabaja así —"MARKER 1…6" dentro de la hoja MK-027— y el sistema
-- hoy solo guarda el total del core, que es una cifra sin desglose.
--
-- Dos consecuencias de que el tendido tenga su PROPIA tela:
--
--   1. Un mismo marker puede mezclar telas. En la hoja MK-027 los
--      tendidos 1 a 5 son ANTIFLUIDO y el 6 es MAXXI. Descontar todo el
--      consumo contra `tela_principal` movería stock de la tela
--      equivocada.
--   2. Corte puede procesar unos tendidos y otros no. Por eso el corte
--      se marca POR TENDIDO y no de golpe para el marker completo.
--
-- Las yardas del core siguen existiendo como total; los tendidos son su
-- desglose. Cuando hay tendidos, el total se deriva de ellos.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

create table if not exists telas.marker_tendidos (
  id              bigint generated always as identity primary key,

  core_id         bigint not null
                  references telas.marker_cores(id) on delete cascade,

  -- Orden dentro del marker: el "MARKER 1", "MARKER 2"… de la hoja.
  -- Es lo que el cortador usa para ubicarse en el papel.
  numero          integer not null,

  -- Nombre del archivo de trazo (MARKER12-T1). Lo escribe quien traza.
  nombre_mm       text,

  -- Cada tendido tiene su propia tela: un marker puede mezclarlas.
  tela            text,
  -- Referencia al catálogo de inventario, para descontar sin adivinar.
  -- Nullable porque el trazo se hace antes de decidir el rollo exacto.
  tela_inventario_id bigint
                  references telas.inventario_telas(id) on delete set null,
  color_tela      text,

  talla           text,
  genero          text,

  -- Longitud del trazo en pulgadas, tal como sale del software de marker.
  largo_trazo_in  numeric,
  -- Yardas de UNA capa. El consumo total sale de multiplicar por capas.
  yardas          numeric,
  capas           integer,
  total_pcs       integer,
  pcs_extra       integer not null default 0,

  -- Tendido total en yardas: lo que de verdad se va a gastar.
  -- Se guarda calculado por el editor en vez de derivarse, porque la
  -- hoja de corte redondea y el valor impreso es el que manda en planta.
  tendido_total   numeric,

  -- ── Lo que registra Corte ──────────────────────────────────────────
  cortado         boolean not null default false,
  fecha_corte     date,
  -- Yardas REALES de este tendido. Puede diferir del teórico.
  yardas_reales   numeric,
  piezas_cortadas integer,
  cortado_por     text,
  notas           text,

  created_at      timestamptz not null default now(),

  -- El número identifica al tendido dentro de su marker.
  unique (core_id, numero)
);

comment on table telas.marker_tendidos is
  'Subdivisión de un marker. Cada tendido es un trazo con su propia tela, '
  'talla y capas; Corte los procesa y descuenta inventario uno por uno.';

comment on column telas.marker_tendidos.yardas is
  'Yardas de UNA capa, como en la hoja de corte. El consumo del tendido '
  'es este valor por el número de capas (columna tendido_total).';

comment on column telas.marker_tendidos.tendido_total is
  'Yardas totales del tendido. Se guarda en vez de derivarse porque la '
  'hoja de corte redondea y su cifra impresa es la que se usa en planta.';

create index if not exists marker_tendidos_core_idx
  on telas.marker_tendidos (core_id, numero);

-- "Qué queda por cortar" es la consulta del cortador.
create index if not exists marker_tendidos_pendientes_idx
  on telas.marker_tendidos (core_id)
  where cortado = false;


-- ---------------------------------------------------------------------
-- El movimiento de inventario puede venir de un tendido
-- ---------------------------------------------------------------------
-- Ya existían `pedido` y `core_id`. El tendido es más preciso: dice qué
-- trazo concreto consumió la tela, que es lo que permite auditar por
-- qué un marker gastó de más.
alter table telas.inventario_movimientos
  add column if not exists tendido_id bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventario_movimientos_tendido_fk'
  ) then
    alter table telas.inventario_movimientos
      add constraint inventario_movimientos_tendido_fk
      foreign key (tendido_id) references telas.marker_tendidos(id)
      on delete set null;
  end if;
end $$;

comment on column telas.inventario_movimientos.tendido_id is
  'Tendido que consumió la tela. Más preciso que core_id: identifica el '
  'trazo exacto dentro del marker.';

create index if not exists idx_inv_mov_tendido
  on telas.inventario_movimientos (tendido_id)
  where tendido_id is not null;


-- ---------------------------------------------------------------------
-- Avance del marker por tendidos
-- ---------------------------------------------------------------------
-- Con tendidos, un marker ya no está "cortado" o "sin cortar": puede ir
-- a medias. Esta vista es lo que Corte necesita para saber qué falta.
create or replace view telas.vista_marker_tendidos_avance as
select
  c.id                as core_id,
  c.nombre            as core_nombre,
  c.estado            as core_estado,
  count(t.id)                                          as tendidos,
  count(t.id) filter (where t.cortado)                 as cortados,
  count(t.id) filter (where not t.cortado)             as pendientes,
  coalesce(sum(t.tendido_total), 0)                    as yardas_teoricas,
  coalesce(sum(t.yardas_reales) filter (where t.cortado), 0) as yardas_reales,
  coalesce(sum(t.total_pcs), 0)                        as pcs_planeadas,
  coalesce(sum(t.piezas_cortadas) filter (where t.cortado), 0) as pcs_cortadas,
  -- Telas distintas del marker: si es más de una, el consumo NO se puede
  -- descontar contra una sola referencia.
  count(distinct t.tela) filter (where t.tela is not null) as telas_distintas
from telas.marker_cores c
left join telas.marker_tendidos t on t.core_id = c.id
group by c.id, c.nombre, c.estado;

grant select on telas.vista_marker_tendidos_avance
  to anon, authenticated, service_role;

grant select, insert, update, delete on telas.marker_tendidos
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema telas
  to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
-- 1) La tabla y la vista existen:
-- select count(*) from telas.marker_tendidos;
-- select * from telas.vista_marker_tendidos_avance limit 5;
--
-- 2) Markers a medio cortar (lo que antes no se podía ver):
-- select core_nombre, cortados, pendientes, yardas_reales, yardas_teoricas
--   from telas.vista_marker_tendidos_avance
--  where pendientes > 0 and cortados > 0;
--
-- 3) Markers que mezclan telas: su consumo va contra varias referencias.
-- select core_nombre, telas_distintas
--   from telas.vista_marker_tendidos_avance
--  where telas_distintas > 1;

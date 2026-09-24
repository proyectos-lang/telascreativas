-- =====================================================================
-- Consumo de tela en Corte → salida automática de inventario
-- ---------------------------------------------------------------------
-- Hoy alguien descuenta el consumo a mano y escribe el motivo en texto
-- libre. En los 336 movimientos existentes hay más de 100 formas de
-- decir lo mismo: 'CONSUMO ODT', 'consumo odt', 'Consumo Odt',
-- 'CONSUMO ODT WK38-39', 'CONSUMOS ODT'… y ninguna dice a qué pedido
-- corresponde. Con eso no se puede reconstruir qué orden gastó qué.
--
-- Estas columnas permiten que el descuento lo genere Corte al cerrar,
-- ligado al pedido o al marker que lo causó. Las viejas quedan en NULL:
-- no se inventa un origen que nadie registró.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

-- Origen del movimiento. Null = capturado a mano desde Inventario, que
-- es como se hacía hasta ahora y sigue siendo válido.
alter table telas.inventario_movimientos
  add column if not exists pedido text,
  add column if not exists core_id bigint,
  add column if not exists automatico boolean not null default false;

comment on column telas.inventario_movimientos.pedido is
  'Pedido que causó el movimiento. Null en los capturados a mano.';
comment on column telas.inventario_movimientos.core_id is
  'Marker que causó el movimiento, cuando el corte fue de un core completo.';
comment on column telas.inventario_movimientos.automatico is
  'true = lo generó el cierre de Corte; false = captura manual.';

-- El core puede borrarse sin que el movimiento pierda sentido: la tela
-- se consumió igual. Por eso `set null` y no `cascade`.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'inventario_movimientos_core_fk'
  ) then
    alter table telas.inventario_movimientos
      add constraint inventario_movimientos_core_fk
      foreign key (core_id) references telas.marker_cores(id)
      on delete set null;
  end if;
end $$;

-- Buscar "qué consumió este pedido" es la consulta natural de auditoría.
create index if not exists idx_inv_mov_pedido
  on telas.inventario_movimientos (pedido)
  where pedido is not null;

create index if not exists idx_inv_mov_core
  on telas.inventario_movimientos (core_id)
  where core_id is not null;


-- ---------------------------------------------------------------------
-- Tela usada en cada corte
-- ---------------------------------------------------------------------
-- `detalleorden.tela` guarda el NOMBRE de la tela pero no el color,
-- mientras que el inventario sí distingue color: SUPERSOFT tiene 14
-- variantes y ANTIFLUIDO STRETCH 9. Además, solo el 30% de los nombres
-- coincide entre ambos lados ('TELA COLUMBIA' vs 'COLUMBIA').
--
-- Por eso el descuento no se puede deducir: lo elige el cortador al
-- cerrar, y aquí queda registrado cuál eligió. Adivinar movería stock de
-- la tela equivocada, que es peor que no moverlo.
alter table telas.cabecera
  add column if not exists ctela_inventario_id bigint;

comment on column telas.cabecera.ctela_inventario_id is
  'Tela de inventario que Corte declaró haber consumido en esta orden.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cabecera_ctela_inventario_fk'
  ) then
    alter table telas.cabecera
      add constraint cabecera_ctela_inventario_fk
      foreign key (ctela_inventario_id) references telas.inventario_telas(id)
      on delete set null;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
-- 1) Columnas nuevas, todas vacías al arrancar:
-- select count(*) as total,
--        count(pedido) as con_pedido,
--        count(core_id) as con_core,
--        count(*) filter (where automatico) as automaticos
--   from telas.inventario_movimientos;
--
-- 2) Consumo de un pedido concreto:
-- select m.fecha_movimiento, t.nombre, t.color,
--        m.cantidad_metros, m.cantidad_yardas, m.motivo
--   from telas.inventario_movimientos m
--   join telas.inventario_telas t on t.id = m.tela_id
--  where m.pedido = '00002542';

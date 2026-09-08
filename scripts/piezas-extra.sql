-- =====================================================================
-- Piezas extra — inventario acumulado desde Marker Digital y Corte
-- ---------------------------------------------------------------------
-- Al trazar y al cortar quedan piezas de más (retazos aprovechados, un
-- tendido que rindió más de lo previsto). Hoy se pierden: nadie las
-- registra y no hay forma de saber qué hay disponible.
--
-- Cada registro es un movimiento, no un saldo. Así se puede reconstruir
-- de dónde salió cada pieza y, más adelante, darlas de baja cuando se
-- usen sin perder la historia.
--
-- Dos niveles de detalle, a propósito:
--   * MARKER registra solo la CANTIDAD del trazo: al proyectar el marker
--     todavía no se sabe qué talla concreta va a sobrar.
--   * CORTE registra pedido, talla y referencia: ahí las piezas ya están
--     cortadas y se pueden identificar una por una.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

create table if not exists telas.piezas_extra (
  id            bigint generated always as identity primary key,

  -- De dónde salió la pieza. Marker proyecta; Corte confirma.
  origen        text not null check (origen in ('marker','corte')),

  -- Trazabilidad del origen. Ambos son opcionales porque un registro de
  -- marker puede no tener pedido (es del core completo) y uno de corte
  -- puede no venir de un core.
  core_id       bigint references telas.marker_cores(id) on delete set null,
  pedido        text,

  -- Detalle de la pieza. Solo lo llena Corte; en marker quedan NULL.
  talla         text,
  referencia    text,   -- producto/estilo: 'CAMISETA CUELLO REDONDO', etc.
  tela          text,

  cantidad      numeric not null check (cantidad > 0),

  -- Estado del inventario. 'usada' se reserva para cuando exista el flujo
  -- de consumo; por ahora todo nace disponible.
  estado        text not null default 'disponible'
                check (estado in ('disponible','usada','descartada')),

  fecha         date not null default current_date,
  registrado_por text,
  notas         text,
  creado_en     timestamptz not null default now()
);

comment on table telas.piezas_extra is
  'Movimientos de piezas extra. Marker registra solo cantidad (aun no se sabe la talla); Corte registra pedido, talla y referencia.';

-- La consulta habitual es "que hay disponible", y de ahi se filtra por
-- talla o referencia.
create index if not exists piezas_extra_disponibles_idx
  on telas.piezas_extra (estado, fecha desc)
  where estado = 'disponible';

create index if not exists piezas_extra_pedido_idx
  on telas.piezas_extra (pedido);

create index if not exists piezas_extra_core_idx
  on telas.piezas_extra (core_id);

grant select, insert, update, delete on telas.piezas_extra
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema telas
  to anon, authenticated, service_role;

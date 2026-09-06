-- =====================================================================
-- Marker Digital — nueva área de producción y agrupación en "cores"
-- ---------------------------------------------------------------------
-- Marker Digital imprime en plotter los trazos de corte. Va en PARALELO
-- con Impresión y es el nuevo PREREQUISITO de Corte, pero SOLO para las
-- órdenes marcadas con es_marker_digital_si_no = true (ese flag ya
-- existía y hasta ahora no tenía lógica asociada). El resto de las
-- órdenes conserva su flujo actual sin ningún cambio.
--
-- Un "core" agrupa varios pedidos que comparten tipo de tela para
-- cortarlos en volumen. El marker registra las yardas TEÓRICAS del
-- trazo; Corte registra luego las REALES (cyardas, que ya existía y ya
-- era obligatorio) y el contraste entre ambas es el objetivo del módulo.
--
-- Este script NO modifica ninguna columna ni fila existente: solo añade.
-- Ejecutar en el SQL Editor de Supabase. Idempotente (if not exists /
-- on conflict do nothing): se puede re-ejecutar sin duplicar datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cores (agrupaciones de pedidos por tela)
--    Se crean ANTES que las columnas de cabecera porque mdcore_id las
--    referencia.
-- ---------------------------------------------------------------------
create table if not exists telas.marker_cores (
  id                    bigint generated always as identity primary key,
  nombre                text not null unique,   -- lo escribe el marker; único
  tela_principal        text not null,          -- tela mayoritaria del core
  total_pcs             numeric,                -- piezas sumadas al confirmar
  yardas_teoricas       numeric,                -- una sola cifra por core
  yardas_reales         numeric,                -- la que registra Corte al cerrar
  estado                text not null default 'Abierto'
                        check (estado in ('Abierto','Entregado','Recibido en Corte','Cortado')),
  fecha_creacion        timestamptz not null default now(),
  fecha_entrega_marker  date,                   -- se propaga a todas sus órdenes
  fecha_recepcion_corte date,
  fecha_corte           date,
  creado_por            text,
  notas                 text
);

comment on table telas.marker_cores is
  'Agrupación de pedidos que comparten tela para cortarlos juntos. yardas_teoricas las fija Marker Digital y NO deben mostrarse al cortador.';

create index if not exists marker_cores_estado_idx
  on telas.marker_cores (estado, fecha_creacion desc);

-- Pedidos que integran cada core. La relación también se refleja en
-- cabecera.mdcore_id para no obligar a un join en las consultas de
-- producción; esta tabla guarda además el detalle por pedido.
create table if not exists telas.marker_core_pedidos (
  core_id           bigint not null references telas.marker_cores(id) on delete cascade,
  pedido            text not null,
  pcs               numeric,
  telas_secundarias text,   -- observación multi-tela: el 10.7% de las órdenes
                            -- usa más de una tela; se agrupa por la mayoritaria
                            -- y aquí queda constancia de las otras.
  primary key (core_id, pedido)
);

create index if not exists marker_core_pedidos_pedido_idx
  on telas.marker_core_pedidos (pedido);

-- ---------------------------------------------------------------------
-- 2. Columnas del área en telas.cabecera (prefijo md, misma convención
--    que d / c / i / s / cos / e)
-- ---------------------------------------------------------------------
alter table telas.cabecera
  add column if not exists mdfecha_de_recepcion         date,
  add column if not exists mdentrega_marker             date,
  add column if not exists mdfecha_objetivo_md          date,
  add column if not exists mdresponsable                text,
  add column if not exists mdmotivo_demora_recibido_md  text,
  add column if not exists mdmotivo_demora_terminado_md text,
  add column if not exists mdcomentario_marker          text,
  add column if not exists mdcomentario_entrega_md      text,
  add column if not exists mdyardas_teoricas            numeric,
  add column if not exists mdcore_id                    bigint
    references telas.marker_cores(id) on delete set null;

comment on column telas.cabecera.mdcore_id is
  'Core al que pertenece la orden. NULL = se procesa suelta en Marker Digital.';
comment on column telas.cabecera.mdyardas_teoricas is
  'Yardas teóricas prorrateadas del core. Contrastan contra cyardas (real de Corte).';

create index if not exists cabecera_mdcore_id_idx on telas.cabecera (mdcore_id);

-- Cola de Marker Digital: aprobadas, marcadas y aún sin trazo entregado.
create index if not exists cabecera_marker_pendiente_idx
  on telas.cabecera (es_marker_digital_si_no, mdentrega_marker)
  where es_marker_digital_si_no is true;

-- ---------------------------------------------------------------------
-- 3. Permiso de acceso al módulo
-- ---------------------------------------------------------------------
alter table telas.usuarios
  add column if not exists mod_marker boolean not null default false;

-- ---------------------------------------------------------------------
-- 4. Capacidad: parámetros del área nueva
--    limite_fisico = 400 es el TOPE DE PIEZAS POR CORE. El módulo lo lee
--    de aquí para poder ajustarlo sin desplegar código.
-- ---------------------------------------------------------------------
insert into telas.capacidad_areas
  (area, unidad_medida, capacidad_efectiva, limite_fisico, dias_proceso_objetivo,
   puestos, recurso_cuello, notas, activo)
values
  ('Marker', 'pcs_dia', 400, 400, 3, 1, 'plotter_marker',
   'Plotter exclusivo de trazos, compartido con el operador de impresión. limite_fisico = tope de piezas por core (mesa de corte).', true)
on conflict (area) do nothing;

-- Matriz de tiempos: nueva etapa. Solo se añade la columna; NO se
-- recalcula total_dias porque las 20 filas sembradas no incluían el
-- marker y asignarle días sería inventar datos. Se ajusta desde el
-- módulo de Capacidad cuando producción defina el valor real.
alter table telas.capacidad_matriz_tiempos
  add column if not exists dias_marker numeric;

-- ---------------------------------------------------------------------
-- 5. Calibración automática: registrar el campo de fin del área nueva.
--    Es la MISMA función de capacidad-motor.sql, copiada literal, con una
--    única línea añadida: ('Marker','mdentrega_marker'). Se replica entera
--    porque create or replace no admite parches parciales; si algún día
--    cambia el original, hay que volver a copiarla desde allí.
-- ---------------------------------------------------------------------
create or replace function telas.fn_capacidad_calibrar(
  p_ventana_dias int default 365,
  p_aplicar boolean default false
)
returns setof telas.capacidad_calibracion_log
language plpgsql
security definer
set search_path = telas, public
as $$
declare
  v_area  text;
  v_campo text;
  v_row   telas.capacidad_calibracion_log;
  r       record;
begin
  for v_area, v_campo in
    select * from (values
      ('Diseno',      'dentrega_diseno'),
      ('Marker',      'mdentrega_marker'),
      ('Corte',       'cfecha_de_corte'),
      ('Impresion',   'ientrega_impresion'),
      ('Sublimacion', 'seta_sublimacion'),
      ('Costura',     'coseta_costura'),
      ('Empaque',     'efecha_de_empaque')
    ) as t(area, campo)
  loop
    execute format($f$
      with dias as (
        select %1$I::date as fecha_fin,
               count(*)::numeric              as ordenes,
               sum(coalesce(pcs, 0))::numeric as pcs
        from telas.cabecera
        where %1$I is not null
          and %1$I::date >= current_date - $1
          and extract(dow from %1$I::date) <> 0
          and lower(coalesce(estado_aprobado_rechazado, '')) not in ('cancelado','rechazado')
        group by 1
      )
      select count(*)::int                                                           as dias_activos,
             round(avg(pcs)::numeric, 1)                                             as pcs_prom,
             round((percentile_cont(0.5)  within group (order by pcs))::numeric, 1)  as pcs_p50,
             round((percentile_cont(0.85) within group (order by pcs))::numeric, 1)  as pcs_p85,
             round((percentile_cont(0.95) within group (order by pcs))::numeric, 1)  as pcs_p95,
             round(avg(ordenes)::numeric, 1)                                         as ord_prom,
             round((percentile_cont(0.85) within group (order by ordenes))::numeric, 1) as ord_p85
      from dias
    $f$, v_campo)
    into r
    using p_ventana_dias;

    insert into telas.capacidad_calibracion_log
      (area, ventana_dias, dias_activos,
       pcs_dia_prom, pcs_dia_p50, pcs_dia_p85, pcs_dia_p95,
       ordenes_dia_prom, ordenes_dia_p85, baja_confianza, fuente)
    values
      (v_area, p_ventana_dias, coalesce(r.dias_activos, 0),
       r.pcs_prom, r.pcs_p50, r.pcs_p85, r.pcs_p95,
       r.ord_prom, r.ord_p85, coalesce(r.dias_activos, 0) < 60, 'auto')
    returning * into v_row;

    if p_aplicar and r.pcs_p85 is not null then
      update telas.capacidad_areas
      set capacidad_efectiva = r.pcs_p85,
          ordenes_dia_p85    = coalesce(r.ord_p85, ordenes_dia_p85),
          factor_eficiencia  = case
            when capacidad_teorica is not null and capacidad_teorica > 0
            then round(r.pcs_p85 / capacidad_teorica, 3)
            else factor_eficiencia end,
          actualizado_en = now()
      where area = v_area;
    end if;

    return next v_row;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- 6. Permisos (la app usa la anon key; la autenticación es de aplicación)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on telas.marker_cores        to anon, authenticated, service_role;
grant select, insert, update, delete on telas.marker_core_pedidos to anon, authenticated, service_role;
grant usage, select on all sequences in schema telas              to anon, authenticated, service_role;
grant execute on function telas.fn_capacidad_calibrar(int, boolean) to anon, authenticated, service_role;

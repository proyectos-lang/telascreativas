-- =====================================================================
-- Módulo Capacidad v2 — motor de capacidad instalada y disponible (ATP)
-- ---------------------------------------------------------------------
-- Crea las tablas del motor de capacidad (NO toca tablas existentes),
-- siembra los parámetros entregados por producción (P85 histórico, matriz
-- de tiempos por tipo de producción y capacidades por máquina de costura)
-- y define la función de calibración automática desde el histórico de
-- telas.cabecera.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente (if not exists /
-- on conflict do nothing): se puede re-ejecutar sin duplicar datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Parámetros por área (editable desde el módulo, solo admins)
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_areas (
  area                 text primary key,
  unidad_medida        text not null default 'pcs_dia'
                       check (unidad_medida in ('pcs_dia','ordenes_dia','ml_dia')),
  capacidad_teorica    numeric,          -- ingeniería (máquina/puesto)
  capacidad_efectiva   numeric,          -- PARÁMETRO vigente (calibrable con P85)
  factor_eficiencia    numeric,          -- efectiva / teórica
  limite_fisico        numeric,          -- tope duro; capacidad final = LEAST(efectiva, limite_fisico)
  recurso_cuello       text,             -- p. ej. 'operador_impresion'
  puestos              int,
  turnos               int default 1,
  horas_turno          numeric default 8,
  dias_proceso_objetivo numeric,         -- días hábiles objetivo del área (SLA)
  ordenes_dia_p85      numeric,
  colchon_urgentes_pct numeric not null default 0.15,
  notas                text,
  activo               boolean not null default true,
  actualizado_en       timestamptz not null default now()
);

insert into telas.capacidad_areas
  (area, unidad_medida, capacidad_efectiva, ordenes_dia_p85, dias_proceso_objetivo,
   puestos, recurso_cuello, notas, activo)
values
  ('Diseno',      'pcs_dia', 369, 18, 3, 3, null,
   '3 puestos (1 jefe + 2 diseñadores). Meta: 90 diseños/mes por diseñador.', true),
  ('Corte',       'pcs_dia', 305, 15, 3, null, null, null, true),
  ('Impresion',   'pcs_dia', 381, 18, 4, 1, 'operador_impresion',
   '2 impresoras Epson 9470H pero 1 solo operador (comparte con markers en plotter exclusivo). La capacidad NO escala x2 por tener 2 máquinas.', true),
  ('Sublimacion', 'pcs_dia', 364, 17, 5, null, null,
   'Calandra máx 1.4 m/min a 215°C. Teórica = 1.4 x 60 x horas_turno x factor_prenda (camiseta básica = 1.0; más cortes ralentizan). Unidad nativa: metros lineales/día; convertir a pcs con metros/pieza por producto.', true),
  ('Costura',     'pcs_dia', 380, 17, 6, null, null,
   'Ver telas.capacidad_maquinas para el detalle por máquina (Plana 65/día, Sorgete 300/día).', true),
  ('Empaque',     'pcs_dia', 369, 18, 8, null, null, null, true),
  -- Línea SEPARADA de accesorios (DTF UV + plotter de corte). No consume la
  -- capacidad de Sublimación. Sin fechas propias en cabecera → el motor la
  -- ignora (activo=false); queda visible en Parámetros como referencia.
  ('Accesorios',  'pcs_dia', null, null, null, null, null,
   'Línea separada: 1 impresora DTF UV + 1 plotter de corte para accesorios (bordado, DTF, TPU, vinil). No consume capacidad de Sublimación.', false)
on conflict (area) do nothing;

-- ---------------------------------------------------------------------
-- 2. Log de calibraciones (histórico de la capacidad REAL)
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_calibracion_log (
  id               bigint generated always as identity primary key,
  area             text not null,
  fecha_calculo    timestamptz not null default now(),
  ventana_dias     int not null,
  dias_activos     int not null default 0,
  pcs_dia_prom     numeric,
  pcs_dia_p50      numeric,
  pcs_dia_p85      numeric,
  pcs_dia_p95      numeric,
  ordenes_dia_prom numeric,
  ordenes_dia_p85  numeric,
  baja_confianza   boolean not null default false,   -- dias_activos < 60
  fuente           text not null default 'auto' check (fuente in ('auto','manual'))
);
create index if not exists capacidad_calibracion_log_idx
  on telas.capacidad_calibracion_log (area, ventana_dias, fecha_calculo desc);

-- ---------------------------------------------------------------------
-- 3. Reservas de capacidad (simulaciones confirmadas / manuales)
--    'orden_activa' queda reservado para la fase de integración con el
--    Planner: hoy la carga de órdenes activas se calcula al vuelo.
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_reserva (
  id                bigint generated always as identity primary key,
  pedido            text,
  area              text not null,
  fecha_planificada date not null,
  pcs_reservadas    numeric not null,
  origen            text not null check (origen in ('orden_activa','simulacion','manual')),
  detalle           text,
  creado_por        text,
  creado_en         timestamptz not null default now()
);
create index if not exists capacidad_reserva_idx
  on telas.capacidad_reserva (area, fecha_planificada);

-- ---------------------------------------------------------------------
-- 4. Excepciones de calendario (paros, feriados, mantenimiento, ausencias)
--    factor: 0 = paro total, 0.5 = media capacidad, 1 = normal.
--    area '*' aplica a todas las áreas ese día.
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_excepciones (
  id        bigint generated always as identity primary key,
  area      text not null default '*',
  fecha     date not null,
  factor    numeric not null check (factor >= 0 and factor <= 1),
  motivo    text,
  creado_en timestamptz not null default now(),
  unique (area, fecha)
);

-- ---------------------------------------------------------------------
-- 5. Matriz de tiempos de entrega por tipo de producción (días hábiles
--    Lun–Sáb por etapa). Entregada por producción; base del simulador.
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_matriz_tiempos (
  id               bigint generated always as identity primary key,
  tipo_codigo      int not null,
  tipo_nombre      text not null,
  concepto         text,
  rango            text not null check (rango in ('menor_24','mayor_24')),
  dias_diseno      numeric not null default 0,
  dias_corte       numeric not null default 0,
  dias_aprobacion  numeric not null default 0,
  dias_impresion   numeric not null default 0,
  dias_sublimacion numeric not null default 0,
  dias_costura     numeric not null default 0,
  total_dias       numeric not null default 0,
  activo           boolean not null default true,
  unique (tipo_codigo, rango)
);

insert into telas.capacidad_matriz_tiempos
  (tipo_codigo, tipo_nombre, concepto, rango,
   dias_diseno, dias_corte, dias_aprobacion, dias_impresion, dias_sublimacion, dias_costura, total_dias)
values
  (1, 'Prediseño', 'Diseño hecho en Telas C. donde solo se cambia nombre o número y va directo a imprimir.', 'menor_24', 2,1,0,1,1,1, 6),
  (1, 'Prediseño', 'Diseño hecho en Telas C. donde solo se cambia nombre o número y va directo a imprimir.', 'mayor_24', 3,3,0,1,1,3, 11),
  (2, 'Prediseño con cambios', 'Diseño hecho en Telas C. con cambios mínimos como logos.', 'menor_24', 3,1,1,1,2,3, 11),
  (2, 'Prediseño con cambios', 'Diseño hecho en Telas C. con cambios mínimos como logos.', 'mayor_24', 3,3,2,3,2,5, 18),
  (3, 'Diseño editable', 'El cliente envía el diseño solo para 1 talla y se adapta al resto de tallas.', 'menor_24', 3,1,1,1,2,3, 11),
  (3, 'Diseño editable', 'El cliente envía el diseño solo para 1 talla y se adapta al resto de tallas.', 'mayor_24', 3,3,2,3,2,5, 18),
  (4, 'Diseño directo a impresión', 'No requiere modificación; solo lo valida el Jefe de diseño para mandar a impresión.', 'menor_24', 2,1,0,1,1,1, 6),
  (4, 'Diseño directo a impresión', 'No requiere modificación; solo lo valida el Jefe de diseño para mandar a impresión.', 'mayor_24', 3,3,2,3,2,5, 18),
  (5, 'Diseño nuevo para aprobación', 'Diseño desde cero, se espera aprobación del cliente.', 'menor_24', 3,1,1,1,2,3, 11),
  (5, 'Diseño nuevo para aprobación', 'Diseño desde cero, se espera aprobación del cliente.', 'mayor_24', 5,3,2,2,2,4, 18),
  (6, 'Diseño nuevo sin cambios', 'Diseño desde cero SIN opción a cambios.', 'menor_24', 3,1,1,1,1,2, 9),
  (6, 'Diseño nuevo sin cambios', 'Diseño desde cero SIN opción a cambios.', 'mayor_24', 4,3,1,2,2,3, 15),
  (7, 'Yardaje directo a impresión sin costura', 'El cliente manda las medidas y solo se imprime (el impresor valida el archivo).', 'menor_24', 1,1,0,1,2,0, 5),
  (7, 'Yardaje directo a impresión sin costura', 'El cliente manda las medidas y solo se imprime (el impresor valida el archivo).', 'mayor_24', 2,0,0,2,3,0, 7),
  (8, 'Yardaje directo a impresión con costura', 'Igual al anterior pero especifica el tipo de costura.', 'menor_24', 1,1,0,1,2,1, 6),
  (8, 'Yardaje directo a impresión con costura', 'Igual al anterior pero especifica el tipo de costura.', 'mayor_24', 2,3,0,2,2,4, 13),
  (9, 'Yardaje con diseño nuevo sin costura', 'Diseño desde cero para yardaje, se espera aprobación.', 'menor_24', 3,0,1,2,2,0, 8),
  (9, 'Yardaje con diseño nuevo sin costura', 'Diseño desde cero para yardaje, se espera aprobación.', 'mayor_24', 4,0,1,2,3,0, 10),
  (10, 'Yardaje con diseño nuevo con costura', 'Diseño desde cero para yardaje + tipo de costura especificado.', 'menor_24', 3,1,1,1,2,1, 9),
  (10, 'Yardaje con diseño nuevo con costura', 'Diseño desde cero para yardaje + tipo de costura especificado.', 'mayor_24', 4,3,1,2,2,3, 15)
on conflict (tipo_codigo, rango) do nothing;

-- ---------------------------------------------------------------------
-- 6. Capacidad por máquina de costura (tipo de construcción)
-- ---------------------------------------------------------------------
create table if not exists telas.capacidad_maquinas (
  id         bigint generated always as identity primary key,
  maquina    text not null,             -- 'Plana' | 'Sorgete'
  categoria  text,                       -- POLO / SOCIAL-COLUMBIA / VARIOS / null = total máquina
  pcs_dia    numeric not null,
  pcs_semana numeric not null,
  activo     boolean not null default true
);
create unique index if not exists capacidad_maquinas_uniq
  on telas.capacidad_maquinas (maquina, coalesce(categoria, ''));

insert into telas.capacidad_maquinas (maquina, categoria, pcs_dia, pcs_semana)
values
  ('Plana',   'POLO',              30, 150),
  ('Plana',   'SOCIAL / COLUMBIA', 20, 100),
  ('Plana',   'VARIOS',            15, 75),
  ('Plana',   null,                65, 325),   -- subtotal Plana
  ('Sorgete', null,               300, 1500)   -- Sorgete / Remalle
  -- Meta total: 365 pcs/día · 1825 pcs/semana (derivada: Plana + Sorgete)
on conflict (maquina, coalesce(categoria, '')) do nothing;

-- ---------------------------------------------------------------------
-- 7. Función de calibración: capacidad REAL desde el histórico de cabecera
-- ---------------------------------------------------------------------
-- Agrupa por (área, día de fecha de fin), cuenta órdenes y suma cabecera.pcs;
-- excluye domingos y órdenes canceladas/rechazadas; percentiles sobre los
-- días CON actividad dentro de la ventana móvil.
-- IMPORTANTE: volumen SIEMPRE desde cabecera.pcs. NO usar ecantidad_empacada,
-- cyardas ni coscantidad_costurada (históricamente vacíos/erróneos).
-- p_aplicar=true además copia el P85 al parámetro capacidad_efectiva.
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
-- 8. Grants (la app usa la anon key; auth a nivel de aplicación)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on
  telas.capacidad_areas,
  telas.capacidad_calibracion_log,
  telas.capacidad_reserva,
  telas.capacidad_excepciones,
  telas.capacidad_matriz_tiempos,
  telas.capacidad_maquinas
to anon, authenticated, service_role;

grant usage on all sequences in schema telas to anon, authenticated, service_role;

grant execute on function telas.fn_capacidad_calibrar(int, boolean)
to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 9. (Opcional) Calibración automática semanal con pg_cron
--    Requiere habilitar la extensión pg_cron en el proyecto de Supabase
--    (Database → Extensions). Descomenta para programarla:
-- ---------------------------------------------------------------------
-- select cron.schedule(
--   'capacidad-calibracion-semanal',
--   '0 5 * * 1',  -- lunes 5:00 UTC
--   $$ select telas.fn_capacidad_calibrar(180, false);
--      select telas.fn_capacidad_calibrar(365, false); $$
-- );

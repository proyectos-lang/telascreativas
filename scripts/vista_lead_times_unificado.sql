-- =====================================================================
-- Vista unificada de Lead Times (fuente única por-orden)
-- ---------------------------------------------------------------------
-- Una fila por pedido con: fechas de recepción/fin de cada área, los
-- días por área (calendario, fin - recepción; NULL si la etapa no
-- terminó), el lead time global (venta → entrega al cliente) y los
-- flags de universo:
--   en_proceso = aprobado y aún no empacado (pedidos vigentes en planta)
--   cerrado    = ya empacado
--
-- Es la fuente única del gráfico "Eficiencia de Tiempos" del dashboard
-- (dos cálculos: En Proceso vs General) y de la tabla de detalle del
-- 100% de pedidos en el módulo de Indicadores.
--
-- Nota: en Postgres, (date - date) devuelve días enteros directamente.
-- El criterio de negocio (incluir 0 = mismo día, excluir null y
-- negativos) se aplica en el frontend con lead-time-unificado.ts.
-- =====================================================================

create or replace view telas.vista_lead_times_unificado as
select
  c.pedido,
  c.cliente,
  c.vendedora,
  c.ciudad,
  c.estilo_de_la_prenda,
  c.pcs,
  c.es_urgente,
  c.estado_aprobado_rechazado,
  c.fecha_de_ingreso,
  c.fecha_de_entrega,
  c.fecha_entrega_cliente,
  c.entregado_cliente_si_no,
  c.s_estado_entrega,

  -- Fechas por área (recepción / fin)
  c.dfecha_de_ingreso_diseno,
  c.dentrega_diseno,
  c.cfecha_de_recepcion,
  c.cfecha_de_corte,
  c.ifecha_de_ingreso_imp,
  c.ientrega_impresion,
  c.sfecha_de_ingreso_sub,
  c.seta_sublimacion,
  c.cosfecha_conteo,
  c.coseta_costura,
  c.efecha_de_empaque,

  -- Días por área (calendario):
  --   - Si la etapa TERMINÓ: fin - recepción.
  --   - Si NO terminó pero la orden está vigente (en_proceso) y ya fue recibida
  --     en el área: CURRENT_DATE - recepción (tiempo EN CURSO / actual).
  --   - En cualquier otro caso: NULL (no aplica, o abandonada/no vigente).
  -- Así el promedio incluye el tiempo actual de las órdenes que siguen en el
  -- proceso, sin contaminarse con órdenes viejas nunca terminadas.
  case
    when c.dentrega_diseno is not null and c.dfecha_de_ingreso_diseno is not null
    then (c.dentrega_diseno - c.dfecha_de_ingreso_diseno)
    when c.dfecha_de_ingreso_diseno is not null
         and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null
    then (current_date - c.dfecha_de_ingreso_diseno)
  end as dias_en_diseno,
  case
    when c.cfecha_de_corte is not null and c.cfecha_de_recepcion is not null
    then (c.cfecha_de_corte - c.cfecha_de_recepcion)
    when c.cfecha_de_recepcion is not null
         and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null
    then (current_date - c.cfecha_de_recepcion)
  end as dias_en_corte,
  case
    when c.ientrega_impresion is not null and c.ifecha_de_ingreso_imp is not null
    then (c.ientrega_impresion - c.ifecha_de_ingreso_imp)
    when c.ifecha_de_ingreso_imp is not null
         and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null
    then (current_date - c.ifecha_de_ingreso_imp)
  end as dias_en_impresion,
  case
    when c.seta_sublimacion is not null and c.sfecha_de_ingreso_sub is not null
    then (c.seta_sublimacion - c.sfecha_de_ingreso_sub)
    when c.sfecha_de_ingreso_sub is not null
         and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null
    then (current_date - c.sfecha_de_ingreso_sub)
  end as dias_en_sublimacion,
  case
    when c.coseta_costura is not null and c.cosfecha_conteo is not null
    then (c.coseta_costura - c.cosfecha_conteo)
    when c.cosfecha_conteo is not null
         and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null
    then (current_date - c.cosfecha_conteo)
  end as dias_en_costura,

  -- Lead time global (venta → entrega al cliente)
  case
    when c.fecha_entrega_cliente is not null and c.fecha_de_ingreso is not null
    then (c.fecha_entrega_cliente - c.fecha_de_ingreso)
  end as lead_time_global,

  -- Flags de universo
  (c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as en_proceso,
  (c.efecha_de_empaque is not null) as cerrado,

  -- Flags "en curso": la orden vigente ya entró al área pero aún no la terminó.
  -- Cuando es true, el dias_en_<area> de arriba es el tiempo ACTUAL, no el final.
  -- NOTA: van AL FINAL a propósito. CREATE OR REPLACE VIEW solo permite añadir
  -- columnas nuevas al final; insertarlas en medio da error 42P16.
  (c.dfecha_de_ingreso_diseno is not null and c.dentrega_diseno is null
     and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as diseno_en_curso,
  (c.cfecha_de_recepcion is not null and c.cfecha_de_corte is null
     and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as corte_en_curso,
  (c.ifecha_de_ingreso_imp is not null and c.ientrega_impresion is null
     and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as impresion_en_curso,
  (c.sfecha_de_ingreso_sub is not null and c.seta_sublimacion is null
     and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as sublimacion_en_curso,
  (c.cosfecha_conteo is not null and c.coseta_costura is null
     and c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as costura_en_curso

from telas.cabecera c;

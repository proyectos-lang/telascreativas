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

  -- Días por área (calendario, fin - recepción). NULL si la etapa no terminó.
  case
    when c.dentrega_diseno is not null and c.dfecha_de_ingreso_diseno is not null
    then (c.dentrega_diseno - c.dfecha_de_ingreso_diseno)
  end as dias_en_diseno,
  case
    when c.cfecha_de_corte is not null and c.cfecha_de_recepcion is not null
    then (c.cfecha_de_corte - c.cfecha_de_recepcion)
  end as dias_en_corte,
  case
    when c.ientrega_impresion is not null and c.ifecha_de_ingreso_imp is not null
    then (c.ientrega_impresion - c.ifecha_de_ingreso_imp)
  end as dias_en_impresion,
  case
    when c.seta_sublimacion is not null and c.sfecha_de_ingreso_sub is not null
    then (c.seta_sublimacion - c.sfecha_de_ingreso_sub)
  end as dias_en_sublimacion,
  case
    when c.coseta_costura is not null and c.cosfecha_conteo is not null
    then (c.coseta_costura - c.cosfecha_conteo)
  end as dias_en_costura,

  -- Lead time global (venta → entrega al cliente)
  case
    when c.fecha_entrega_cliente is not null and c.fecha_de_ingreso is not null
    then (c.fecha_entrega_cliente - c.fecha_de_ingreso)
  end as lead_time_global,

  -- Flags de universo
  (c.estado_aprobado_rechazado = 'Aprobado' and c.efecha_de_empaque is null) as en_proceso,
  (c.efecha_de_empaque is not null) as cerrado

from telas.cabecera c;

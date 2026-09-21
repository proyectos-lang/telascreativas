-- =====================================================================
-- Inventario Cortado en vista_control_produccion — versión mínima
-- ---------------------------------------------------------------------
-- Se comprobó en la base que la vista NO reacciona a la bandera:
--
--   omite_corte_costura = true      -> status_corte pasa a 'N/A'   (OK)
--   inventario_cortado_si_no = true -> status_corte sigue 'En espera'
--
-- con el valor correctamente escrito en telas.cabecera. Es decir, la
-- vista en producción sigue siendo la versión anterior: el `create view`
-- del fix no llegó a aplicarse.
--
-- Este archivo contiene UNA sola instrucción para descartar ejecuciones
-- parciales: en el SQL Editor de Supabase, si hay texto seleccionado
-- solo se ejecuta la selección, y si se corre por partes puede quedarse
-- en el `drop`.
--
-- CÓMO EJECUTARLO
--   1. Abre el SQL Editor de Supabase.
--   2. Pega TODO este archivo sin seleccionar nada.
--   3. Pulsa Run una sola vez.
--
-- No hace `drop`: `create or replace view` basta porque NO se agregan ni
-- reordenan columnas —las 32 son las mismas, en el mismo orden—; lo
-- único que cambia es la lógica interna de dos CASE. Así, si algo
-- fallara, la vista anterior sigue en pie en vez de desaparecer.
-- =====================================================================

create or replace view telas.vista_control_produccion as
select
  pedido,
  cliente,
  fecha_de_entrega,
  pcs,
  es_urgente,
  solo_corte_costura,
  omite_corte_costura,
  tipo_flujo_especial,
  accesorios_inventario,
  s_estado_entrega,

  case
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when solo_corte_costura = true then 'N/A'::text
    when dentrega_diseno is not null then 'Terminado'::text
    when dfecha_de_ingreso_diseno is not null then 'Recibido'::text
    else 'Pendiente'::text
  end as status_diseno,

  case
    when es_marker_digital_si_no is not true then 'N/A'::text
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when omite_corte_costura = true then 'N/A'::text
    -- <<< LÍNEA NUEVA 1 de 2
    when inventario_cortado_si_no = true then 'N/A'::text
    when mdentrega_marker is not null then 'Terminado'::text
    when cfecha_de_corte is not null then 'N/A'::text
    when mdfecha_de_recepcion is not null then 'Recibido'::text
    else 'Pendiente'::text
  end as status_marker,

  case
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when solo_corte_costura = true then 'N/A'::text
    when ientrega_impresion is not null then 'Terminado'::text
    when ifecha_de_ingreso_imp is not null then 'Recibido'::text
    when tipo_flujo_especial = 'YARDAJE'::text then 'Pendiente'::text
    when dentrega_diseno is not null then 'Pendiente'::text
    else 'En espera'::text
  end as status_impresion,

  case
    when tipo_flujo_especial = 'COMPRA_EXTERNA'::text then 'N/A'::text
    when tipo_flujo_especial = 'VENTA_INVENTARIO'::text
     and (accesorios_inventario is null or accesorios_inventario = ''::text) then 'N/A'::text
    when solo_corte_costura = true then 'N/A'::text
    when seta_sublimacion is not null then 'Terminado'::text
    when sfecha_de_ingreso_sub is not null then 'Recibido'::text
    when tipo_flujo_especial = 'YARDAJE'::text and ientrega_impresion is not null then 'Pendiente'::text
    when tipo_flujo_especial = 'VENTA_INVENTARIO'::text and accesorios_inventario is not null then 'Pendiente'::text
    when cfecha_de_corte is not null and ientrega_impresion is not null then 'Pendiente'::text
    else 'En espera'::text
  end as status_sublimacion,

  case
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when omite_corte_costura = true then 'N/A'::text
    -- <<< LÍNEA NUEVA 2 de 2
    when inventario_cortado_si_no = true then 'N/A'::text
    when cfecha_de_corte is not null then 'Terminado'::text
    when cfecha_de_recepcion is not null then 'Recibido'::text
    when es_marker_digital_si_no is true and mdentrega_marker is null then 'En espera'::text
    when tipo_flujo_especial = 'YARDAJE'::text and seta_sublimacion is not null then 'Pendiente'::text
    when tipo_flujo_especial <> 'YARDAJE'::text then 'Pendiente'::text
    else 'En espera'::text
  end as status_corte,

  case
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when omite_corte_costura = true then 'N/A'::text
    when coseta_costura is not null then 'Terminado'::text
    when cosfecha_conteo is not null then 'Recibido'::text
    when tipo_flujo_especial = 'YARDAJE'::text and cfecha_de_corte is not null then 'Pendiente'::text
    when solo_corte_costura = true and cfecha_de_corte is not null then 'Pendiente'::text
    when solo_corte_costura = false and seta_sublimacion is not null then 'Pendiente'::text
    else 'En espera'::text
  end as status_costura,

  case
    when efecha_de_empaque is not null then 'Terminado'::text
    when edia_de_entrega is not null then 'Recibido'::text
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'Pendiente'::text
    when coseta_costura is not null then 'Pendiente'::text
    else 'En espera'::text
  end as status_empaque,

  dentrega_diseno    as fecha_fin_diseno,
  mdentrega_marker   as fecha_fin_marker,
  cfecha_de_corte    as fecha_fin_corte,
  ientrega_impresion as fecha_fin_impresion,
  seta_sublimacion   as fecha_fin_sublimacion,
  coseta_costura     as fecha_fin_costura,
  efecha_de_empaque  as fecha_fin_empaque,

  dentrega_diseno    - dfecha_de_ingreso_diseno as dias_en_diseno,
  mdentrega_marker   - mdfecha_de_recepcion     as dias_en_marker,
  cfecha_de_corte    - cfecha_de_recepcion      as dias_en_corte,
  ientrega_impresion - ifecha_de_ingreso_imp    as dias_en_impresion,
  seta_sublimacion   - sfecha_de_ingreso_sub    as dias_en_sublimacion,
  coseta_costura     - cosfecha_conteo          as dias_en_costura,

  fecha_de_entrega - current_date as dias_para_entrega,
  case
    when (fecha_de_entrega - current_date) < 0 then 'Vencido'::text
    when (fecha_de_entrega - current_date) <= 2 then 'Riesgo Crítico'::text
    when (fecha_de_entrega - current_date) <= 5 then 'Riesgo Medio'::text
    else 'A Tiempo'::text
  end as nivel_riesgo

from telas.cabecera
where estado_aprobado_rechazado = 'Aprobado'::text
  and efecha_de_empaque is null;

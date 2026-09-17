-- =====================================================================
-- Recrear vista_control_produccion con Inventario Cortado
-- ---------------------------------------------------------------------
-- La bandera `inventario_cortado_si_no` ya existe en telas.cabecera y la
-- app la escribe bien, pero la vista en produccion NO tiene las dos
-- condiciones que la leen: se verifico marcando una orden real y
-- status_marker y status_corte seguian devolviendo Pendiente / En espera.
--
-- Este script solo recrea esa vista. Es el mismo DDL que ya vive en
-- marker-vistas.sql (seccion 3); se extrae aparte para no tener que
-- volver a ejecutar las cuatro vistas.
--
-- Que cambia respecto a la version en produccion: dos lineas.
--   status_marker -> 'N/A' cuando inventario_cortado_si_no = true
--   status_corte  -> 'N/A' cuando inventario_cortado_si_no = true
--
-- Ambas van ANTES de evaluar fechas, para que datos viejos no muestren
-- la orden como Terminado en un area por la que ya no pasa.
--
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

drop view if exists telas.vista_control_produccion;

create view telas.vista_control_produccion as
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

  -- Área nueva: solo existe para las órdenes marcadas.
  case
    when es_marker_digital_si_no is not true then 'N/A'::text
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    -- Ojo: solo_corte_costura NO excluye. Esas órdenes saltan Diseño,
    -- Impresión y Sublimación, pero SÍ pasan por Corte, así que necesitan
    -- trazo igual.
    when omite_corte_costura = true then 'N/A'::text
    -- Inventario cortado: las piezas ya vienen cortadas, no hay trazo que
    -- hacer. Va antes de evaluar fechas para que datos viejos no la
    -- muestren como Terminado.
    when inventario_cortado_si_no = true then 'N/A'::text
    when mdentrega_marker is not null then 'Terminado'::text
    -- Órdenes anteriores al área: ya se cortaron sin trazo. Mostrarlas como
    -- "Pendiente" anunciaría un paso que nunca va a ocurrir.
    when cfecha_de_corte is not null then 'N/A'::text
    when mdfecha_de_recepcion is not null then 'Recibido'::text
    -- Marker Digital NO depende de Diseño: el trazo se hace con las medidas
    -- y la tela, que ya vienen en la orden. Por eso queda 'Pendiente' desde
    -- que la orden se aprueba, sin esperar a que Diseño entregue.
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

  -- Corte: con marker, ya no basta la aprobación; espera el trazo.
  case
    when tipo_flujo_especial = any (array['COMPRA_EXTERNA'::text, 'VENTA_INVENTARIO'::text]) then 'N/A'::text
    when omite_corte_costura = true then 'N/A'::text
    -- Inventario cortado: la orden entra con las piezas ya cortadas y
    -- pasa directo a Costura.
    when inventario_cortado_si_no = true then 'N/A'::text
    when cfecha_de_corte is not null then 'Terminado'::text
    when cfecha_de_recepcion is not null then 'Recibido'::text
    -- Con marker, Corte no puede tomar la orden hasta tener el trazo.
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

grant select on telas.vista_control_produccion to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- Verificacion
-- ---------------------------------------------------------------------
-- Debe devolver 0 filas: ninguna orden de inventario cortado puede
-- quedar con un estado activo en Marker o en Corte.
--
-- select pedido, status_marker, status_corte
--   from telas.vista_control_produccion v
--   join telas.cabecera c using (pedido)
--  where c.inventario_cortado_si_no = true
--    and (v.status_marker <> 'N/A' or v.status_corte <> 'N/A');

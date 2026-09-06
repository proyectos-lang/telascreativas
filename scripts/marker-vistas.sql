-- =====================================================================
-- Marker Digital — integración en las vistas de indicadores
-- ---------------------------------------------------------------------
-- Agrega el área Marker Digital a las cuatro vistas analíticas, para que
-- aparezca en Adherencia, Lead Times, el pipeline del Dashboard y el
-- Plan Semanal.
--
-- Las definiciones de abajo parten del DDL REAL de cada vista (exportado
-- desde Supabase); lo único que cambia es lo que añade el área nueva.
-- El resto se conserva literal, incluidos los filtros de estado —que NO
-- son iguales entre vistas— y el orden de las columnas.
--
-- Marker Digital solo aplica a las órdenes con es_marker_digital_si_no.
-- En las demás, sus columnas quedan NULL o 'N/A' y no contaminan ningún
-- promedio ni porcentaje.
--
-- `create or replace view` solo permite AÑADIR columnas al final: como
-- las del marker van en medio (por orden de flujo), hay que recrear cada
-- vista. Si no, Postgres da el error 42P16.
--
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. vista_kpi_adherencia  (+ adherencia_marker)
--
-- OJO: el DDL original de esta vista no se conservó. La definición se
-- reconstruyó desde los datos y se verificó celda por celda contra la
-- vista en producción: 6 áreas x 5 semanas de agosto 2026, más
-- total_ordenes, cumplidos_global y adherencia_global, coinciden EXACTO.
-- Reglas confirmadas empíricamente:
--   * El periodo se define por la fecha de EMPAQUE, no la de entrega.
--   * adherencia_global = empaque <= compromiso, sobre el total (es la
--     adherencia OPERATIVA, de planta).
--   * adherencia_<area> = fin <= objetivo, con denominador = órdenes que
--     TIENEN fin registrado en esa área (no el total). Se validó con el
--     caso que lo distingue: semana 33, Corte da 21/64 = 32.81 y no
--     21/63 = 33.33.
-- ---------------------------------------------------------------------
drop view if exists telas.vista_kpi_adherencia;

create view telas.vista_kpi_adherencia as
select
  extract(year  from c.efecha_de_empaque)::int as ano,
  extract(month from c.efecha_de_empaque)::int as mes,
  extract(week  from c.efecha_de_empaque)::int as semana,

  count(*)::bigint as total_ordenes,

  round(100.0 * count(*) filter (where c.dentrega_diseno <= c.dfecha_objetivo_d)
        / nullif(count(*) filter (where c.dentrega_diseno is not null), 0), 2)
    as adherencia_diseno,

  -- Área nueva. Las órdenes sin marker no tienen mdentrega_marker, así
  -- que no entran al denominador y no diluyen el indicador.
  round(100.0 * count(*) filter (where c.mdentrega_marker <= c.mdfecha_objetivo_md)
        / nullif(count(*) filter (where c.mdentrega_marker is not null), 0), 2)
    as adherencia_marker,

  round(100.0 * count(*) filter (where c.ientrega_impresion <= c.ifecha_objetivo_i)
        / nullif(count(*) filter (where c.ientrega_impresion is not null), 0), 2)
    as adherencia_impresion,

  round(100.0 * count(*) filter (where c.seta_sublimacion <= c.sfecha_objetivo_s)
        / nullif(count(*) filter (where c.seta_sublimacion is not null), 0), 2)
    as adherencia_sublimacion,

  round(100.0 * count(*) filter (where c.cfecha_de_corte <= c.cfecha_objetivo_c)
        / nullif(count(*) filter (where c.cfecha_de_corte is not null), 0), 2)
    as adherencia_corte,

  round(100.0 * count(*) filter (where c.coseta_costura <= c.cosfecha_objetivo_cs)
        / nullif(count(*) filter (where c.coseta_costura is not null), 0), 2)
    as adherencia_costura,

  round(100.0 * count(*) filter (where c.efecha_de_empaque <= c.efecha_objetivo_e)
        / nullif(count(*) filter (where c.efecha_de_empaque is not null), 0), 2)
    as adherencia_empaque,

  count(*) filter (where c.efecha_de_empaque <= c.fecha_de_entrega)::bigint
    as cumplidos_global,
  round(100.0 * count(*) filter (where c.efecha_de_empaque <= c.fecha_de_entrega)
        / nullif(count(*), 0), 2)
    as adherencia_global

from telas.cabecera c
where c.efecha_de_empaque is not null
group by 1, 2, 3;

grant select on telas.vista_kpi_adherencia to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. vista_kpi_lead_times  (+ dias_en_marker y las colas del marker)
--
-- Se conserva el DDL original tal cual: agrupa por fecha_de_ingreso
-- (isoyear/mes/semana) y excluye solo 'Cancelado'.
--
-- Sobre las colas: el flujo con marker es
--     Diseño → (Marker ‖ Impresión) → Corte
-- así que se agregan dos columnas nuevas al final —cola_diseno_a_marker
-- y cola_marker_a_corte— SIN tocar las cinco existentes. Las órdenes sin
-- marker no tienen esas fechas, así que quedan fuera del promedio.
--
-- Nota sobre `dias_en_corte`, que da 0.00: no es un defecto de la vista.
-- De 1239 órdenes con ambas fechas, 614 registran recepción y corte el
-- MISMO día. Es cómo se captura en planta, no un error de cálculo.
-- ---------------------------------------------------------------------
drop view if exists telas.vista_kpi_lead_times;

create view telas.vista_kpi_lead_times as
select
  extract(isoyear from fecha_de_ingreso)::integer as ano,
  extract(month   from fecha_de_ingreso)::integer as mes,
  extract(week    from fecha_de_ingreso)::integer as semana,

  round(avg(fecha_entrega_cliente - fecha_de_ingreso), 2) as lead_time_global_promedio,

  round(avg(dentrega_diseno    - dfecha_de_ingreso_diseno), 2) as dias_en_diseno,
  round(avg(mdentrega_marker   - mdfecha_de_recepcion),     2) as dias_en_marker,
  round(avg(ientrega_impresion - ifecha_de_ingreso_imp),    2) as dias_en_impresion,
  round(avg(seta_sublimacion   - sfecha_de_ingreso_sub),    2) as dias_en_sublimacion,
  round(avg(cfecha_de_corte    - cfecha_de_recepcion),      2) as dias_en_corte,
  round(avg(coseta_costura     - cosfecha_conteo),          2) as dias_en_costura,
  round(avg(efecha_de_empaque  - edia_de_entrega),          2) as dias_en_empaque,

  round(avg(ifecha_de_ingreso_imp - dentrega_diseno),   2) as cola_diseno_a_impresion,
  round(avg(sfecha_de_ingreso_sub - ientrega_impresion), 2) as cola_impresion_a_sublimacion,
  round(avg(cfecha_de_recepcion   - seta_sublimacion),   2) as cola_sublimacion_a_corte,
  round(avg(cosfecha_conteo       - cfecha_de_corte),    2) as cola_corte_a_costura,
  round(avg(edia_de_entrega       - coseta_costura),     2) as cola_costura_a_empaque,

  -- Colas del marker (al final: no alteran las anteriores).
  round(avg(mdfecha_de_recepcion - dentrega_diseno),   2) as cola_diseno_a_marker,
  round(avg(cfecha_de_recepcion  - mdentrega_marker),  2) as cola_marker_a_corte

from telas.cabecera
where estado_aprobado_rechazado is distinct from 'Cancelado'::text
group by
  (extract(isoyear from fecha_de_ingreso)),
  (extract(month   from fecha_de_ingreso)),
  (extract(week    from fecha_de_ingreso));

grant select on telas.vista_kpi_lead_times to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- 3. vista_control_produccion  (+ status_marker, fecha_fin_marker,
--    dias_en_marker)
--
-- Alimenta el pipeline y el radar de riesgo del Dashboard. Se conserva
-- el DDL original íntegro —incluido el cálculo de nivel_riesgo y el
-- filtro (Aprobado + sin empacar)—; solo se añaden las tres columnas del
-- área nueva.
--
-- status_marker sigue el mismo patrón que las demás áreas: 'N/A' cuando
-- la orden no pasa por ahí, y Terminado / Recibido / Pendiente / En
-- espera según sus fechas. Para las órdenes sin marcar es siempre 'N/A',
-- de modo que el pipeline no muestra un paso que nunca va a ocurrir.
-- ---------------------------------------------------------------------
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
    when solo_corte_costura = true then 'N/A'::text
    when omite_corte_costura = true then 'N/A'::text
    when mdentrega_marker is not null then 'Terminado'::text
    -- Órdenes anteriores al área: ya se cortaron sin trazo. Mostrarlas como
    -- "Pendiente" anunciaría un paso que nunca va a ocurrir.
    when cfecha_de_corte is not null then 'N/A'::text
    when mdfecha_de_recepcion is not null then 'Recibido'::text
    when dentrega_diseno is not null then 'Pendiente'::text
    else 'En espera'::text
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
-- 4. vista_plan_semanal  (+ fin_marker y MARKER en estatus_actual)
--
-- Se conserva el DDL original íntegro. Dos cambios:
--   * Nueva columna fin_marker.
--   * En el árbol de estatus_actual, las ramas de PRODUCCION_NORMAL y
--     YARDAJE ganan un escalón 'MARKER' entre DISEÑO y CORTE, pero SOLO
--     cuando es_marker_digital_si_no es true. Sin la bandera, el árbol
--     se recorre exactamente igual que antes.
-- ---------------------------------------------------------------------
drop view if exists telas.vista_plan_semanal;

create view telas.vista_plan_semanal as
select
  extract(isoyear from fecha_de_entrega)::integer as ano_entrega,
  extract(week    from fecha_de_entrega)::integer as semana_ano,
  fecha_de_entrega,
  pedido,
  cliente,
  vendedora,
  ddisenador as disenador,
  maquina_costura,
  split_part(estilo_de_la_prenda, '/'::text, 1) as estilo_de_la_prenda,
  pcs,
  tipo_flujo_especial,
  costura_si_no,
  solo_corte_costura,
  omite_corte_costura,
  accesorios_inventario,
  estado_aprobado_rechazado,
  dentrega_diseno       as fin_diseno,
  mdentrega_marker      as fin_marker,
  ientrega_impresion    as fin_impresion,
  seta_sublimacion      as fin_sublimacion,
  cfecha_de_corte       as fin_corte,
  coseta_costura        as fin_costura,
  efecha_de_empaque     as fin_empaque,
  fecha_entrega_cliente as fin_entrega_cliente,

  case
    when fecha_entrega_cliente is not null then 'ENTREGADO'::text
    when estado_aprobado_rechazado = 'Pendiente'::text
      or estado_aprobado_rechazado is null then 'POR PROGRAMAR'::text
    when coalesce(tipo_flujo_especial, 'PRODUCCION_NORMAL'::text) = 'COMPRA_EXTERNA'::text then 'ENTREGAS'::text
    when coalesce(tipo_flujo_especial, 'PRODUCCION_NORMAL'::text) = 'VENTA_INVENTARIO'::text then case
      when efecha_de_empaque is not null then 'ENTREGAS'::text
      when accesorios_inventario is not null and accesorios_inventario <> ''::text then case
        when seta_sublimacion is null then 'SUBLIMACION'::text
        else 'EMPAQUE'::text
      end
      else 'EMPAQUE'::text
    end
    when coalesce(tipo_flujo_especial, 'PRODUCCION_NORMAL'::text) = 'YARDAJE'::text then case
      when costura_si_no = false then case
        when seta_sublimacion is not null then 'ENTREGAS'::text
        when dentrega_diseno is null then 'DISEÑO'::text
        when ientrega_impresion is null then 'IMPRESION'::text
        else 'SUBLIMACION'::text
      end
      else case
        when efecha_de_empaque is not null then 'ENTREGAS'::text
        when coseta_costura is not null then 'EMPAQUE'::text
        when dentrega_diseno is null then 'DISEÑO'::text
        when ientrega_impresion is null then 'IMPRESION'::text
        when seta_sublimacion is null then 'SUBLIMACION'::text
        -- El trazo va antes del corte cuando la orden es marker.
        when es_marker_digital_si_no is true and mdentrega_marker is null then 'MARKER'::text
        when cfecha_de_corte is null then 'CORTE'::text
        else 'COSTURA'::text
      end
    end
    else case
      when solo_corte_costura = true then case
        when efecha_de_empaque is not null then 'ENTREGAS'::text
        when coseta_costura is not null then 'EMPAQUE'::text
        when cfecha_de_corte is null then 'CORTE'::text
        else 'COSTURA'::text
      end
      when omite_corte_costura = true or costura_si_no = false then case
        when efecha_de_empaque is not null then 'ENTREGAS'::text
        when dentrega_diseno is null then 'DISEÑO'::text
        when ientrega_impresion is null then 'IMPRESION'::text
        when seta_sublimacion is null then 'SUBLIMACION'::text
        else 'EMPAQUE'::text
      end
      else case
        when efecha_de_empaque is not null then 'ENTREGAS'::text
        when coseta_costura is not null then 'EMPAQUE'::text
        when dentrega_diseno is null then 'DISEÑO'::text
        when ientrega_impresion is null then 'IMPRESION'::text
        when seta_sublimacion is null then 'SUBLIMACION'::text
        when es_marker_digital_si_no is true and mdentrega_marker is null then 'MARKER'::text
        when cfecha_de_corte is null then 'CORTE'::text
        else 'COSTURA'::text
      end
    end
  end as estatus_actual

from telas.cabecera
where estado_aprobado_rechazado is distinct from 'Rechazado'::text
  and estado_aprobado_rechazado is distinct from 'cancelado'::text;

grant select on telas.vista_plan_semanal to anon, authenticated, service_role;

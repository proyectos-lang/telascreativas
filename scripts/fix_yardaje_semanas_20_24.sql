-- =====================================================================
-- Soporte: limpiar yardajes atascados en EMPAQUE (plan semanal, sem 20-24)
-- ---------------------------------------------------------------------
-- Contexto: los pedidos de YARDAJE (solo sublimado; tras sublimar se
-- entregan a Ventas, NO pasan por empaque) creados ANTES de la corrección
-- del flujo quedaron con tipo_flujo_especial = 'PRODUCCION_NORMAL' y
-- costura_si_no = false. Como no están marcados como YARDAJE, la vista
-- vista_plan_semanal calcula su estatus_actual = 'EMPAQUE' y siguen
-- apareciendo ahí, cuando ya deberían reflejarse en ENTREGAS.
--
-- Verificado: las 32 órdenes de sem 20-24 en EMPAQUE cumplen el patrón
-- yardaje-sublimado (PRODUCCION_NORMAL + costura=false + sublimadas + sin
-- corte/costura/empaque), 0 anomalías. Al re-etiquetarlas como YARDAJE, la
-- vista las mueve automáticamente a ENTREGAS (igual que los yardajes nuevos).
--
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- 1) (Opcional) Previsualizar ANTES de actualizar:
-- select pedido, tipo_flujo_especial, costura_si_no, seta_sublimacion,
--        cfecha_de_corte, coseta_costura, efecha_de_empaque
-- from telas.cabecera
-- where pedido in (
--   '00001101','00001109','00001118','00001127','00001146','00001149','00001155',
--   '00001166','00001167','00001169','00001171','00001180','00001181','00001202',
--   '00001203','00001207','00001248','00001273','00001285','00001288','00001289',
--   '00001294','00001320','00001328','00001331','00001333','00001346','00001363',
--   '00001370','00001377','00001378','00001400'
-- );

-- 2) Aplicar la corrección:
update telas.cabecera
set tipo_flujo_especial = 'YARDAJE'
where pedido in (
  '00001101','00001109','00001118','00001127','00001146','00001149','00001155',
  '00001166','00001167','00001169','00001171','00001180','00001181','00001202',
  '00001203','00001207','00001248','00001273','00001285','00001288','00001289',
  '00001294','00001320','00001328','00001331','00001333','00001346','00001363',
  '00001370','00001377','00001378','00001400'
)
-- Guarda de seguridad: solo las que realmente son yardaje-sublimado
-- (ya sublimadas y sin corte/costura/empaque).
and (costura_si_no is false)
and seta_sublimacion is not null
and cfecha_de_corte is null
and coseta_costura is null
and efecha_de_empaque is null;

-- 3) Verificar que ya no queden en EMPAQUE (debe volver vacío):
-- select pedido, estatus_actual
-- from telas.vista_plan_semanal
-- where semana_ano between 20 and 24
--   and upper(estatus_actual) = 'EMPAQUE';

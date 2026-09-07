-- =====================================================================
-- Rechazo de órdenes — acuse de recibo de Ventas
-- ---------------------------------------------------------------------
-- Cuando Programación rechaza una orden, Ventas no se enteraba: el motivo
-- quedaba guardado en `motivo_rechazo` pero nadie recibía aviso.
--
-- Se añaden dos columnas para que la vendedora pueda marcar el rechazo
-- como visto. Sin ellas el aviso tendría que desaparecer solo al cambiar
-- el estado de la orden, y no habría constancia de quién lo leyó ni
-- cuándo.
--
-- Este script NO modifica ninguna columna ni fila existente: solo añade.
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table telas.cabecera
  add column if not exists rechazo_visto_por text,
  add column if not exists rechazo_visto_en  timestamptz;

comment on column telas.cabecera.rechazo_visto_por is
  'Email de quien marcó como visto el rechazo. NULL = pendiente de revisar por Ventas.';
comment on column telas.cabecera.rechazo_visto_en is
  'Momento del acuse. Se limpia junto con rechazo_visto_por al reaprobar o volver a rechazar la orden.';

-- Los rechazos pendientes se consultan por (estado, acuse): el índice
-- parcial mantiene barata esa búsqueda aunque cabecera siga creciendo.
create index if not exists cabecera_rechazo_pendiente_idx
  on telas.cabecera (estado_aprobado_rechazado, rechazo_visto_en)
  where estado_aprobado_rechazado = 'Rechazado';

-- =====================================================================
-- Empaque: envío a bordado  +  Corte: firma de recibido de Costura
-- ---------------------------------------------------------------------
-- 1) EMPAQUE → BORDADO
--    Hay prendas que Empaque recibe pero manda a BORDADO (proceso externo).
--    Hoy se leen como "En Proceso" en Empaque aunque físicamente están en
--    bordado, y la firma de entrega a ventas solo ocurre cuando retornan.
--    Estas columnas permiten marcar ese estado intermedio y bloquear el
--    cierre del empaque mientras la orden esté fuera.
--
-- 2) CORTE → FIRMA DE COSTURA
--    Cuando la orden no pasa por Diseño/Impresión/Sublimación (o es YARDAJE),
--    Corte entrega directo a Costura. Se habilita la firma de recibido, igual
--    que ya hace Sublimación con `s_firma_recibe_costura`.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table telas.cabecera
  add column if not exists e_enviado_bordado      boolean default false,
  add column if not exists e_fecha_envio_bordado  date,
  add column if not exists e_fecha_retorno_bordado date,
  add column if not exists e_comentario_bordado   text;

comment on column telas.cabecera.e_enviado_bordado is
  'Empaque envió la orden a bordado (proceso externo). Mientras sea true no se puede cerrar el empaque.';

alter table telas.cabecera
  add column if not exists c_firma_recibe_costura text;

comment on column telas.cabecera.c_firma_recibe_costura is
  'URL de la firma con la que Costura recibe de Corte (bucket firmas-procesos). Solo aplica cuando Corte entrega directo a Costura: solo_corte_costura o YARDAJE.';

-- Nota: la firma se guarda en el bucket público `firmas-procesos`, el mismo
-- que ya usan `s_firma_recibe_costura` y `e_firma_recibe_vendedora`. No hace
-- falta crear bucket ni políticas nuevas.

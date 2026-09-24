-- =====================================================================
-- Consumo de tela en Sublimación
-- ---------------------------------------------------------------------
-- Las órdenes de YARDAJE sin corte/costura van de Sublimación directo a
-- Entregas: nunca pasan por Corte, que es donde se registran las yardas.
-- Su consumo de tela hoy no se captura en ningún lado.
--
-- Medido en la base: de 310 órdenes de yardaje, 181 no pasan por Corte
-- y NINGUNA tiene consumo registrado. Cero de 181. Las 129 que sí pasan
-- por Corte lo registran ahí con normalidad.
--
-- Estas columnas replican en Sublimación lo que `cyardas` y
-- `ctela_inventario_id` hacen en Corte, para que esas 181 dejen de ser
-- un hueco en el consumo de tela.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================

alter table telas.cabecera
  add column if not exists syardas numeric,
  add column if not exists stela_inventario_id bigint;

comment on column telas.cabecera.syardas is
  'Yardas de tela consumidas registradas en Sublimación. Para las órdenes '
  'de yardaje que no pasan por Corte, es el único registro de su consumo.';
comment on column telas.cabecera.stela_inventario_id is
  'Tela de inventario que Sublimación declaró haber consumido.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'cabecera_stela_inventario_fk'
  ) then
    alter table telas.cabecera
      add constraint cabecera_stela_inventario_fk
      foreign key (stela_inventario_id) references telas.inventario_telas(id)
      on delete set null;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
-- 1) Las columnas existen y arrancan vacías:
-- select count(*) as total,
--        count(syardas) as con_yardas,
--        count(stela_inventario_id) as con_tela
--   from telas.cabecera;
--
-- 2) Las órdenes que necesitan este registro —yardaje sin corte— y
--    cuántas ya lo tienen:
-- select count(*) as sin_corte,
--        count(syardas) as ya_registradas
--   from telas.cabecera
--  where tipo_flujo_especial = 'YARDAJE'
--    and (costura_si_no is false or omite_corte_costura = true);
--
-- 3) Consumo registrado desde Sublimación, con su tela:
-- select c.pedido, c.syardas, t.nombre, t.color
--   from telas.cabecera c
--   join telas.inventario_telas t on t.id = c.stela_inventario_id
--  where c.syardas is not null;

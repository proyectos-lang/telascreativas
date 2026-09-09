-- =====================================================================
-- Estudio 3D — generador de diseños sobre modelos GLB
-- ---------------------------------------------------------------------
-- Módulo experimental, restringido por la columna `mod_estudio_3d` de
-- telas.usuarios. Arranca habilitado SOLO para sebas@telas.com.
--
-- Se apoya en lo que ya existe en Gestión de Diseños y no lo duplica:
--   * telas.catalogo_colores      (110 colores con CMYK y hex)
--   * telas.gd_catalogo_simbolos  (patrones y texturas)
--   * telas.catalogo_tipos_prenda (150 tipos de prenda)
--   * bucket 'gd-archivos'        (logos y archivos subidos)
--
-- Aporta dos cosas nuevas:
--   1. QUÉ modelo 3D corresponde a cada tipo de prenda (estudio_modelos).
--   2. Los diseños que el usuario arma (estudio_disenos).
--
-- El diseño se guarda como JSON, no como columnas: es un documento de
-- edición (capas, posiciones, escalas) que va a cambiar de forma mientras
-- el módulo madura. Congelarlo en columnas obligaría a migrar la tabla en
-- cada ajuste del editor.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Permiso de acceso
-- ---------------------------------------------------------------------
alter table telas.usuarios
  add column if not exists mod_estudio_3d boolean not null default false;

comment on column telas.usuarios.mod_estudio_3d is
  'Acceso al Estudio 3D (generador de diseños). Módulo experimental.';

-- Solo el usuario pedido. El resto queda en false por el default.
update telas.usuarios
   set mod_estudio_3d = true
 where lower(email) = 'sebas@telas.com';


-- ---------------------------------------------------------------------
-- 2. Modelos GLB disponibles
-- ---------------------------------------------------------------------
-- Un modelo sirve para MUCHOS tipos de prenda: el catálogo tiene 150
-- tipos pero muchos comparten silueta (todas las camisetas ATP se ven
-- igual en 3D). Por eso la relación no es 1:1 con catalogo_tipos_prenda:
-- el modelo se elige por su cuenta y `tipos_prenda` guarda con qué tipos
-- se sugiere, como ayuda, sin ser una restricción.
create table if not exists telas.estudio_modelos (
  id              bigint generated always as identity primary key,

  nombre          text not null unique,
  -- URL pública del .glb en Supabase Storage.
  archivo_url     text not null,

  -- Silueta: camiseta, chaqueta, pantalón… Sirve para agrupar en la UI.
  categoria       text,

  -- Nombres de catalogo_tipos_prenda a los que se parece este modelo.
  -- Texto libre a propósito: el catálogo tiene duplicados de nombre y
  -- una FK obligaría a mantener una correspondencia que hoy no existe.
  tipos_prenda    text[],

  -- Nombres de los materiales del GLB que reciben el diseño. Un modelo
  -- puede traer partes que NO se pintan (cremalleras, botones); sin esta
  -- lista habría que pintarlas todas o adivinar cuáles.
  materiales      text[],

  -- Cómo se orienta el modelo al abrirlo, para que el frente mire a la
  -- cámara sin que el usuario tenga que rotarlo.
  rotacion_y      numeric not null default 0,
  escala          numeric not null default 1,

  activo          boolean not null default true,
  orden           integer not null default 0,
  notas           text,
  creado_por      text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_estudio_modelos_activo
  on telas.estudio_modelos (activo, orden);


-- ---------------------------------------------------------------------
-- 3. Diseños guardados
-- ---------------------------------------------------------------------
create table if not exists telas.estudio_disenos (
  id              bigint generated always as identity primary key,

  nombre          text not null,
  modelo_id       bigint references telas.estudio_modelos(id) on delete set null,

  -- Documento completo del editor: color base, textura, capas de logos
  -- con su posición y escala, por vista (frontal / trasera). Ver
  -- `DisenoEstudio` en lib/estudio-3d/tipos.ts para la forma exacta.
  documento       jsonb not null default '{}'::jsonb,

  -- Render exportado del visor 3D, para listar sin abrir el editor.
  preview_url     text,

  -- Dueño del diseño. Email, que es la llave de telas.usuarios.
  creado_por      text not null,
  cliente         text,
  notas           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_estudio_disenos_autor
  on telas.estudio_disenos (creado_por, updated_at desc);

-- `updated_at` se mantiene solo: si dependiera de que el cliente lo
-- mande, cualquier update que lo olvide dejaría el orden de la lista
-- mintiendo sobre cuál se tocó de último.
create or replace function telas.fn_estudio_disenos_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_estudio_disenos_touch on telas.estudio_disenos;
create trigger trg_estudio_disenos_touch
  before update on telas.estudio_disenos
  for each row execute function telas.fn_estudio_disenos_touch();


-- ---------------------------------------------------------------------
-- 4. Grants
-- ---------------------------------------------------------------------
-- La app entra con la anon key y resuelve la autorización a nivel de
-- aplicación contra telas.usuarios, igual que el resto de los módulos.
grant select, insert, update, delete
  on telas.estudio_modelos, telas.estudio_disenos
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema telas
  to anon, authenticated, service_role;


-- ---------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------
-- select email, mod_estudio_3d from telas.usuarios where mod_estudio_3d;
-- select count(*) from telas.estudio_modelos;
-- select count(*) from telas.estudio_disenos;

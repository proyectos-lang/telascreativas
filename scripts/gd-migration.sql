-- ============================================================
-- Gestión de Diseños — Migración Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Permisos en tabla usuarios
ALTER TABLE telas.usuarios
  ADD COLUMN IF NOT EXISTS gd_ventas   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gd_diseno   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS gd_admin    boolean DEFAULT false;

-- 2. Tabla principal: solicitudes de diseño
CREATE TABLE IF NOT EXISTS telas.gestion_disenos (
  id                        SERIAL PRIMARY KEY,
  numero                    text UNIQUE NOT NULL,
  cliente                   text NOT NULL,
  vendedora                 text NOT NULL,
  fecha_creacion            timestamptz DEFAULT now(),

  tipo_diseno               text,
  tematica                  text,
  tipos_prenda              text[],
  segunda_prenda_activa     boolean DEFAULT false,
  segunda_prenda_relacion   text,
  tipo_manga                text,

  color_fondo               text,
  color_secundario          text,
  simbolos_seleccionados    integer[],

  lleva_logos               boolean DEFAULT false,
  cantidad_logos            integer,
  posiciones_logos_prenda1  jsonb,
  posiciones_logos_prenda2  jsonb,
  lleva_patrocinadores      boolean DEFAULT false,
  cantidad_patrocinadores   integer,

  diseno_base               text,
  imagenes_simbolos         text,
  accesorios                text,
  tipografia                text,
  otros_detalles            text,

  segunda_tipo_prenda       text,
  segunda_color_fondo       text,
  segunda_color_secundario  text,
  segunda_simbolos          integer[],
  segunda_diseno_base       text,
  segunda_imagenes_simbolos text,
  segunda_posiciones_logos  jsonb,
  segunda_otros_detalles    text,
  segunda_bolsas            boolean DEFAULT false,

  urls_prototipo_prenda     text[],
  urls_prototipo_segunda    text[],
  urls_diseno_base          text[],
  urls_imagenes_simbolos    text[],
  urls_recreacion           text[],

  estado                    text DEFAULT 'Borrador',
  estado_turno              text DEFAULT 'En Ventas',

  disenador                 text,
  fecha_asignacion          timestamptz,
  motivo_rechazo_diseno     text,

  aprobacion_ventas         text,
  imagen_aprobada_url       text,
  comentario_aprobacion     text,
  fecha_aprobacion          timestamptz,

  pedido_vinculado          text,
  total_propuestas          integer DEFAULT 0
);

-- 3. Tabla de propuestas / versiones
CREATE TABLE IF NOT EXISTS telas.gestion_disenos_propuestas (
  id                      SERIAL PRIMARY KEY,
  gestion_id              integer NOT NULL REFERENCES telas.gestion_disenos(id) ON DELETE CASCADE,
  numero_propuesta        integer NOT NULL,

  imagen_mockup_url       text,
  comentario_diseno       text,
  fecha_subida            timestamptz,

  estado                  text DEFAULT 'Pendiente',

  cliente_token           text UNIQUE,
  cliente_token_creado    timestamptz,

  respuesta_cliente       text,
  comentario_cliente      text,
  fecha_respuesta_cliente timestamptz,

  respuesta_ventas        text,
  comentario_ventas       text,
  imagen_cambio_url       text,
  fecha_respuesta_ventas  timestamptz,

  archivos_finales_urls   text[],
  fecha_archivos_finales  timestamptz,

  created_at              timestamptz DEFAULT now()
);

-- 4. Catálogo de símbolos / texturas
CREATE TABLE IF NOT EXISTS telas.gd_catalogo_simbolos (
  id          SERIAL PRIMARY KEY,
  nombre      text NOT NULL,
  categoria   text,
  imagen_url  text NOT NULL,
  activo      boolean DEFAULT true,
  orden       integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- 5. Índices útiles
CREATE INDEX IF NOT EXISTS idx_gd_vendedora ON telas.gestion_disenos(vendedora);
CREATE INDEX IF NOT EXISTS idx_gd_estado ON telas.gestion_disenos(estado);
CREATE INDEX IF NOT EXISTS idx_gdp_gestion_id ON telas.gestion_disenos_propuestas(gestion_id);
CREATE INDEX IF NOT EXISTS idx_gdp_token ON telas.gestion_disenos_propuestas(cliente_token);

-- ============================================================
-- Buckets de Storage (crear en Supabase > Storage):
--   - gd-archivos  (público)   → prototipos .ai, mockups, archivos finales
--   - gd-catalogos (público)   → imágenes del catálogo de símbolos/texturas
-- ============================================================

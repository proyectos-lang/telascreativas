-- =====================================================================
-- Comunicaciones Internas — FASE 7 (Noticias y novedades)
-- ---------------------------------------------------------------------
-- Canal oficial de la empresa hacia el personal: publicaciones segmentadas
-- con adjuntos, programación/vigencia, destacadas, confirmación de lectura
-- obligatoria, reacciones y comentarios, e histórico buscable.
-- Ejecutar en el SQL Editor de Supabase (después de las fases anteriores).
-- =====================================================================

create table if not exists telas.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text,                               -- texto con formato (markdown)
  categoria text,                            -- comunicado | novedad | politica | urgente | reconocimiento | celebracion
  autor text,                                -- email del publicador
  destacada boolean default false,           -- se fija arriba del tablero
  obligatoria boolean default false,         -- requiere confirmación de lectura
  reacciones_habilitadas boolean default true,
  comentarios_habilitados boolean default true,
  publicar_at timestamptz default now(),     -- programación (no aparece antes)
  vigencia_hasta timestamptz,                -- opcional: al cumplirse sale del tablero (queda en histórico)
  created_at timestamptz default now()
);

create index if not exists noticias_publicar_idx on telas.noticias (publicar_at desc);

-- Segmentación de audiencia (varias filas por noticia).
create table if not exists telas.noticia_segmentos (
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references telas.noticias(id) on delete cascade,
  tipo text not null,                        -- org | area | grupo
  valor text                                 -- área (nombre) o conversacion_id (grupo); null para org
);

create index if not exists noticia_segmentos_noticia_idx on telas.noticia_segmentos (noticia_id);

-- Adjuntos de la noticia.
create table if not exists telas.noticia_adjuntos (
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references telas.noticias(id) on delete cascade,
  url text not null,
  nombre text,
  tamano bigint,
  mime text,
  es_imagen boolean default false
);

create index if not exists noticia_adjuntos_noticia_idx on telas.noticia_adjuntos (noticia_id);

-- Confirmación de lectura (evidencia).
create table if not exists telas.noticia_lecturas (
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references telas.noticias(id) on delete cascade,
  usuario_email text not null,
  confirmada_at timestamptz default now(),
  unique (noticia_id, usuario_email)
);

create index if not exists noticia_lecturas_noticia_idx on telas.noticia_lecturas (noticia_id);
create index if not exists noticia_lecturas_usuario_idx on telas.noticia_lecturas (usuario_email);

-- Reacciones (una por usuario por noticia).
create table if not exists telas.noticia_reacciones (
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references telas.noticias(id) on delete cascade,
  usuario_email text not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique (noticia_id, usuario_email)
);

create index if not exists noticia_reacciones_noticia_idx on telas.noticia_reacciones (noticia_id);

-- Comentarios.
create table if not exists telas.noticia_comentarios (
  id uuid primary key default gen_random_uuid(),
  noticia_id uuid not null references telas.noticias(id) on delete cascade,
  usuario_email text,
  texto text,
  created_at timestamptz default now()
);

create index if not exists noticia_comentarios_noticia_idx on telas.noticia_comentarios (noticia_id, created_at);

grant select, insert, update, delete on telas.noticias to anon, authenticated, service_role;
grant select, insert, update, delete on telas.noticia_segmentos to anon, authenticated, service_role;
grant select, insert, update, delete on telas.noticia_adjuntos to anon, authenticated, service_role;
grant select, insert, update, delete on telas.noticia_lecturas to anon, authenticated, service_role;
grant select, insert, update, delete on telas.noticia_reacciones to anon, authenticated, service_role;
grant select, insert, update, delete on telas.noticia_comentarios to anon, authenticated, service_role;

-- Realtime para avisar al personal cuando se publica una noticia.
do $$
begin
  begin alter publication supabase_realtime add table telas.noticias; exception when duplicate_object then null; end;
end $$;

-- Habilitar el permiso de publicar a un usuario (ajusta el email):
-- update telas.usuarios set com_publicar_noticias = true where email = 'gerencia@telas.com';

-- =====================================================================
-- Comunicaciones Internas — FASE 1 (Mensajería 1:1 + fundaciones)
-- ---------------------------------------------------------------------
-- Crea el modelo base de chat (conversaciones, participantes, mensajes),
-- agrega foto de perfil y permiso de noticias a usuarios, habilita
-- realtime y prepara el bucket de avatares.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- 1) Perfil de usuario: foto + permiso para publicar noticias (fases futuras)
alter table telas.usuarios add column if not exists foto_url text;
alter table telas.usuarios add column if not exists com_publicar_noticias boolean default false;

-- 2) Conversaciones (directa 1:1 o grupo — el grupo llega en Fase 3)
create table if not exists telas.chat_conversaciones (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'directa',      -- 'directa' | 'grupo'
  nombre text,                                -- solo grupos
  descripcion text,                           -- solo grupos
  foto_url text,                              -- solo grupos
  creado_por text,                            -- email
  created_at timestamptz default now(),
  updated_at timestamptz default now()        -- última actividad (ordena la lista)
);

-- 3) Participantes (par conversación-usuario único)
create table if not exists telas.chat_participantes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references telas.chat_conversaciones(id) on delete cascade,
  usuario_email text not null,
  rol text not null default 'miembro',        -- 'admin' | 'miembro'
  joined_at timestamptz default now(),        -- historial visible desde aquí (grupos)
  left_at timestamptz,
  last_read_at timestamptz,                   -- para "leído" y no leídos
  last_delivered_at timestamptz,              -- para "recibido"
  unique (conversacion_id, usuario_email)
);

create index if not exists chat_participantes_usuario_idx
  on telas.chat_participantes (usuario_email);
create index if not exists chat_participantes_conv_idx
  on telas.chat_participantes (conversacion_id);

-- 4) Mensajes
create table if not exists telas.chat_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references telas.chat_conversaciones(id) on delete cascade,
  remitente_email text not null,
  contenido text,
  tipo text not null default 'texto',         -- texto | imagen | archivo | tarea | referencia | evento
  reply_to uuid references telas.chat_mensajes(id) on delete set null,  -- citar mensaje
  referencia_tipo text,                       -- 'pedido' | 'gestion' (cuando tipo='referencia')
  referencia_valor text,                      -- pedido (text) o gestion id
  created_at timestamptz default now()
);

create index if not exists chat_mensajes_conv_idx
  on telas.chat_mensajes (conversacion_id, created_at);

-- 5) Permisos (consistente con el resto de la app: acceso a nivel de aplicación)
grant usage on schema telas to anon, authenticated, service_role;
grant select, insert, update, delete on telas.chat_conversaciones to anon, authenticated, service_role;
grant select, insert, update, delete on telas.chat_participantes  to anon, authenticated, service_role;
grant select, insert, update, delete on telas.chat_mensajes       to anon, authenticated, service_role;

-- 6) Realtime: publicar las tablas de chat para suscripciones en tiempo real
do $$
begin
  begin
    alter publication supabase_realtime add table telas.chat_mensajes;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table telas.chat_participantes;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table telas.chat_conversaciones;
  exception when duplicate_object then null; end;
end $$;

-- 7) Bucket de avatares (crear en Storage con acceso público):
--    Storage → New bucket → name: "user-avatars", Public: ON.
--    (El chat de Fase 2 usará otro bucket público "chat-adjuntos".)

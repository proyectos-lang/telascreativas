-- =====================================================================
-- Comunicaciones Internas — FASE 2 (Fotos y archivos adjuntos)
-- ---------------------------------------------------------------------
-- Adjuntos por mensaje (imágenes desde cámara/galería y archivos de
-- documento/hoja de cálculo). Los archivos se guardan en un bucket
-- público "chat-adjuntos" (acceso a nivel de aplicación).
-- Ejecutar en el SQL Editor de Supabase (después de la Fase 1).
-- =====================================================================

create table if not exists telas.chat_adjuntos (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references telas.chat_mensajes(id) on delete cascade,
  conversacion_id uuid references telas.chat_conversaciones(id) on delete cascade,
  url text not null,
  nombre text,
  tamano bigint,
  mime text,
  es_imagen boolean default false,
  created_at timestamptz default now()
);

create index if not exists chat_adjuntos_mensaje_idx
  on telas.chat_adjuntos (mensaje_id);
create index if not exists chat_adjuntos_conv_idx
  on telas.chat_adjuntos (conversacion_id, created_at);

grant select, insert, update, delete on telas.chat_adjuntos
  to anon, authenticated, service_role;

-- Realtime para adjuntos (llegan justo después del mensaje).
do $$
begin
  begin
    alter publication supabase_realtime add table telas.chat_adjuntos;
  exception when duplicate_object then null; end;
end $$;

-- Bucket de adjuntos del chat (crear en Storage con acceso público):
--   Storage → New bucket → name: "chat-adjuntos", Public: ON.

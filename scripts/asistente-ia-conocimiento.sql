-- =====================================================================
-- Asistente IA — Memoria / conocimiento compartido del equipo
-- ---------------------------------------------------------------------
-- Base de conocimiento común (curada) que el agente escribe y que se
-- inyecta en TODAS las conversaciones para que "aprenda" con el tiempo.
-- Ejecutar en el SQL Editor de Supabase (después de asistente-ia.sql).
-- =====================================================================

create table if not exists telas.ia_conocimiento (
  id uuid primary key default gen_random_uuid(),
  contenido text not null,           -- el aprendizaje (regla, definición, preferencia, corrección)
  categoria text,                    -- opcional: tallaje / eficiencia / cliente / definicion ...
  usuario_email text,                -- quién lo originó
  activo boolean default true,       -- soft-delete: false = ignorado por el agente
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists ia_conocimiento_activo_idx
  on telas.ia_conocimiento (activo, created_at);

grant select, insert, update, delete on telas.ia_conocimiento
  to anon, authenticated, service_role;

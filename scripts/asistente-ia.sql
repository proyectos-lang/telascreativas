-- =====================================================================
-- Módulo "Asistente IA" — agente Claude de solo lectura (SELECT)
-- ---------------------------------------------------------------------
-- Crea: permiso por usuario, tablas de conversación/historial y una
-- función SEGURA que ejecuta únicamente SELECT contra el schema telas.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

-- 1) Permiso de acceso al módulo (por usuario)
alter table telas.usuarios
  add column if not exists asistente_ia boolean default false;

-- Habilitar para un usuario de prueba (ajusta el email):
-- update telas.usuarios set asistente_ia = true where email = 'proyectos@telas.com';

-- 2) Conversaciones e historial (memoria del asistente)
create table if not exists telas.ia_conversaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_email text,
  titulo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists telas.ia_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid references telas.ia_conversaciones(id) on delete cascade,
  rol text,              -- 'user' | 'assistant'
  contenido text,
  created_at timestamptz default now()
);

create index if not exists ia_mensajes_conv_idx
  on telas.ia_mensajes (conversacion_id, created_at);

create index if not exists ia_conversaciones_usuario_idx
  on telas.ia_conversaciones (usuario_email, updated_at desc);

grant usage on schema telas to anon, authenticated, service_role;
grant select, insert, update, delete on telas.ia_conversaciones to anon, authenticated, service_role;
grant select, insert, update, delete on telas.ia_mensajes to anon, authenticated, service_role;

-- 3) Función de ejecución SEGURA de SELECT
-- Solo permite una única sentencia SELECT/WITH de lectura. Bloquea DDL/DML,
-- encadenamiento de sentencias, la tabla usuarios (password en texto plano)
-- y esquemas del sistema. Aplica LIMIT y statement_timeout. Devuelve JSON.
create or replace function telas.ia_run_select(consulta text)
returns jsonb
language plpgsql
security definer
set search_path = telas, public
as $$
declare
  resultado jsonb;
  q text := btrim(consulta);
  lower_q text := lower(btrim(consulta, E' \t\n\r;'));
begin
  if q is null or q = '' then
    raise exception 'Consulta vacía';
  end if;

  -- Debe empezar por SELECT o WITH
  if lower_q !~ '^(select|with)\s' then
    raise exception 'Solo se permiten consultas SELECT';
  end if;

  -- Sin encadenar múltiples sentencias (permite un ; final)
  if position(';' in btrim(q, E' \t\n\r;')) > 0 then
    raise exception 'No se permiten múltiples sentencias';
  end if;

  -- Sin operaciones de escritura / DDL en ninguna parte (incluye CTE de escritura)
  if lower_q ~ '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge|vacuum|reindex|refresh|comment|listen|notify|lock|explain|analyze)\y' then
    raise exception 'Operación no permitida (solo lectura)';
  end if;

  -- Protege la tabla de usuarios (contiene password) y esquemas del sistema
  if lower_q ~ '\yusuarios\y' then
    raise exception 'La tabla usuarios no está disponible para consulta';
  end if;
  if lower_q ~ '(auth\.|pg_|information_schema|pg_catalog)' then
    raise exception 'Acceso a esquemas del sistema no permitido';
  end if;

  perform set_config('statement_timeout', '8000', true);

  -- Envuelve la consulta del usuario y aplica un LIMIT de seguridad antes de agregar a JSON.
  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (select * from (%s) sub limit 500) t',
    q
  ) into resultado;

  return resultado;
end;
$$;

-- Solo el backend (service_role) y anon pueden invocarla. anon ya puede leer
-- las tablas de telas vía PostgREST, así que esto no amplía el acceso de datos;
-- la función solo agrega la capacidad de armar SELECT arbitrarios de lectura.
revoke all on function telas.ia_run_select(text) from public;
grant execute on function telas.ia_run_select(text) to anon, authenticated, service_role;

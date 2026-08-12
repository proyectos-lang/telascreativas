-- =====================================================================
-- Módulo "Capacidad" — permiso de acceso
-- ---------------------------------------------------------------------
-- El acceso al módulo Capacidad (carga por semana vs capacidad de planta,
-- pensado para el personal comercial) se controla con el permiso
-- `mod_capacidad`, editable desde Configuración de usuarios.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

alter table telas.usuarios
  add column if not exists mod_capacidad boolean default false;

-- Los administradores conservan acceso (para poder otorgarlo a los demás).
update telas.usuarios set mod_capacidad = true where mod_admin = true;

-- Opcional: habilitar el acceso a todo el personal comercial de una vez.
-- Ajusta el criterio (por cargo/área) a tu realidad y descomenta:
-- update telas.usuarios set mod_capacidad = true
--   where lower(coalesce(cargo,'')) like '%vent%'
--      or lower(coalesce(area,''))  like '%comercial%';

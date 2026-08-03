-- =====================================================================
-- Comunicaciones Internas — permiso de acceso al módulo
-- ---------------------------------------------------------------------
-- El acceso a Comunicaciones (Mensajería, Tareas y Noticias) pasa a estar
-- controlado por el permiso `mod_comunicaciones`, editable desde el módulo
-- de Configuración de usuarios.
-- Ejecutar en el SQL Editor de Supabase.
-- =====================================================================

alter table telas.usuarios
  add column if not exists mod_comunicaciones boolean default false;

-- Los administradores conservan acceso (para poder otorgarlo a los demás).
update telas.usuarios set mod_comunicaciones = true where mod_admin = true;

-- Opcional: habilitar el acceso a TODOS los usuarios existentes de una vez
-- (descomenta si quieres que todo el personal tenga chat desde el inicio):
-- update telas.usuarios set mod_comunicaciones = true;

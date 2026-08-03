-- =====================================================================
-- Comunicaciones Internas — políticas de Storage (RLS) para los buckets
-- ---------------------------------------------------------------------
-- La app usa la llave ANON para todo (la autenticación es a nivel de
-- aplicación, no Supabase Auth), por lo que el rol efectivo al subir
-- archivos es `anon`. La tabla storage.objects tiene RLS activo: sin una
-- política de INSERT/UPDATE para `anon`, la subida falla con
-- "new row violates row-level security policy".
--
-- Este script habilita subir / actualizar / leer / borrar objetos en los
-- buckets públicos que usa la app:
--   - user-avatars   (fotos de perfil)
--   - chat-adjuntos  (adjuntos del chat)
--
-- Requisito previo: crear ambos buckets como PÚBLICOS en
--   Supabase → Storage → New bucket.
--
-- Ejecutar en el SQL Editor de Supabase. Es idempotente (drop + create).
-- =====================================================================

-- ---------- user-avatars ----------
drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'user-avatars');

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'user-avatars')
  with check (bucket_id = 'user-avatars');

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'user-avatars');

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'user-avatars');

-- ---------- chat-adjuntos ----------
drop policy if exists "chat_adjuntos_insert" on storage.objects;
create policy "chat_adjuntos_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'chat-adjuntos');

drop policy if exists "chat_adjuntos_update" on storage.objects;
create policy "chat_adjuntos_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'chat-adjuntos')
  with check (bucket_id = 'chat-adjuntos');

drop policy if exists "chat_adjuntos_select" on storage.objects;
create policy "chat_adjuntos_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'chat-adjuntos');

drop policy if exists "chat_adjuntos_delete" on storage.objects;
create policy "chat_adjuntos_delete" on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'chat-adjuntos');

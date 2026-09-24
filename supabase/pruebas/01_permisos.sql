-- Permisos de tabla que en Supabase vienen dados por la API. RLS decide
-- después qué filas ve cada uno.
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

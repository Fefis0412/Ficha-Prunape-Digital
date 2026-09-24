-- ============================================================================
--  Pruebas de aislamiento (RLS)
--
--  Escenario:
--    Centro A ─ ana (admin) · tomas (terapeuta) · rita (terapeuta)
--    Centro B ─ berta (terapeuta)
--    super    ─ superadmin, sin centro
--
--  Cada bloque afirma algo que DEBE cumplirse. Si alguna afirmación falla,
--  el script aborta con ON_ERROR_STOP y la prueba se considera fallada.
-- ============================================================================

\set ON_ERROR_STOP on
set client_min_messages to notice;

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function pruebas_como(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  execute 'set local role authenticated';
end $$;

create or replace function afirmar(p_ok boolean, p_desc text) returns void
language plpgsql as $$
begin
  if p_ok then
    raise notice '  ok   %', p_desc;
  else
    raise exception 'FALLÓ: %', p_desc;
  end if;
end $$;

-- ── datos de partida (como service_role, saltea RLS) ───────────────────────
begin;
set local role postgres;

insert into catalogos (version, nombre, definicion)
values (1, 'PRUNAPE v1', '{"items":[]}'::jsonb)
on conflict (version) do nothing;

insert into centros (id, nombre, slug) values
  ('11111111-1111-1111-1111-111111111111', 'Centro A', 'centro-a'),
  ('22222222-2222-2222-2222-222222222222', 'Centro B', 'centro-b');

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@a.bo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'tomas@a.bo'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'rita@a.bo'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'berta@b.bo'),
  ('ffffffff-0000-0000-0000-000000000001', 'super@plataforma.bo');

insert into perfiles (id, nombre, email, centro_id, rol, es_superadmin) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana',   'ana@a.bo',   '11111111-1111-1111-1111-111111111111', 'admin',     false),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Tomás', 'tomas@a.bo', '11111111-1111-1111-1111-111111111111', 'terapeuta', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Rita',  'rita@a.bo',  '11111111-1111-1111-1111-111111111111', 'terapeuta', false),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Berta', 'berta@b.bo', '22222222-2222-2222-2222-222222222222', 'terapeuta', false),
  ('ffffffff-0000-0000-0000-000000000001', 'Super', 'super@plataforma.bo', null, null, true);

insert into pacientes (id, centro_id, nombre, apellido, fecha_nacimiento, responsable_id) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Mateo', 'Rojas',  '2024-03-15', 'aaaaaaaa-0000-0000-0000-000000000002'),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Sofía', 'Mamani', '2023-01-10', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('cccccccc-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Luis',  'Choque', '2022-06-01', 'bbbbbbbb-0000-0000-0000-000000000001');

insert into evaluaciones (id, centro_id, paciente_id, examinador_id, catalogo_version,
                          fecha_pesquisa, edad_postnatal_dias, edad_corregida_dias) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 1,
   '2026-01-10', 666, 666);
commit;

\echo ''
\echo '── 1. Un terapeuta ve SOLO sus propios pacientes ──────────────────────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000002');  -- Tomás
select afirmar((select count(*) from pacientes) = 1,
  'Tomás ve 1 paciente (el suyo), no los 3 del sistema');
select afirmar(exists (select 1 from pacientes where apellido = 'Rojas'),
  'Tomás ve a Rojas, que es suyo');
select afirmar(not exists (select 1 from pacientes where apellido = 'Mamani'),
  'Tomás NO ve a Mamani, que es de su compañera Rita');
select afirmar(not exists (select 1 from pacientes where apellido = 'Choque'),
  'Tomás NO ve a Choque, que es de otro centro');
rollback;

\echo ''
\echo '── 2. El admin del centro ve todo lo de SU centro, nada del otro ──────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000001');  -- Ana
select afirmar((select count(*) from pacientes) = 2,
  'Ana ve los 2 pacientes de su centro');
select afirmar(not exists (select 1 from pacientes where apellido = 'Choque'),
  'Ana NO ve pacientes del Centro B');
rollback;

\echo ''
\echo '── 3. Otro centro está completamente aislado ──────────────────────────'
begin;
select pruebas_como('bbbbbbbb-0000-0000-0000-000000000001');  -- Berta
select afirmar((select count(*) from pacientes) = 1,
  'Berta ve solo su paciente del Centro B');
select afirmar((select count(*) from evaluaciones) = 0,
  'Berta NO ve ninguna evaluación del Centro A');
select afirmar((select count(*) from centros) = 1,
  'Berta ve únicamente su propio centro');
rollback;

\echo ''
\echo '── 4. El superadmin NO lee datos clínicos sin acceso de soporte ───────'
begin;
select pruebas_como('ffffffff-0000-0000-0000-000000000001');  -- Super
select afirmar((select count(*) from centros) = 2,
  'El superadmin sí administra los 2 centros');
select afirmar((select count(*) from pacientes) = 0,
  'El superadmin NO ve pacientes sin abrir acceso de soporte');
select afirmar((select count(*) from evaluaciones) = 0,
  'El superadmin NO ve evaluaciones sin acceso de soporte');
rollback;

\echo ''
\echo '── 5. Con acceso de soporte abierto, sí ve ─ y solo ese centro ────────'
begin;
select pruebas_como('ffffffff-0000-0000-0000-000000000001');
insert into accesos_soporte (superadmin_id, centro_id, motivo, fin)
values ('ffffffff-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'Prueba automatizada de aislamiento', now() + interval '1 hour');
select afirmar((select count(*) from pacientes) = 2,
  'Con soporte abierto ve los 2 pacientes del Centro A');
select afirmar(not exists (select 1 from pacientes where apellido = 'Choque'),
  'El acceso de soporte NO se extiende al Centro B');
rollback;

\echo ''
\echo '── 6. Una evaluación cerrada no se puede modificar ────────────────────'
begin;
set local role postgres;
update evaluaciones set estado = 'cerrada', cerrada_en = now(),
       cerrada_por = 'aaaaaaaa-0000-0000-0000-000000000002'
where id = 'eeeeeeee-0000-0000-0000-000000000001';

select pruebas_como('aaaaaaaa-0000-0000-0000-000000000002');
do $$
begin
  update evaluaciones set observaciones = 'intento de edición'
  where id = 'eeeeeeee-0000-0000-0000-000000000001';
  raise exception 'FALLÓ: se pudo editar una evaluación cerrada';
exception when others then
  if sqlerrm like '%ya fue cerrada%' then
    raise notice '  ok   Editar una evaluación cerrada es rechazado por la base';
  else raise; end if;
end $$;
rollback;

\echo ''
\echo '── 7. Los registros clínicos no se borran ─────────────────────────────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000001');  -- Ana, admin
do $$
declare n int;
begin
  delete from pacientes where apellido = 'Rojas';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALLÓ: se borró un paciente'; end if;
  raise notice '  ok   DELETE sobre pacientes no borra nada';
exception when insufficient_privilege then
  raise notice '  ok   DELETE sobre pacientes lo rechaza el permiso de tabla';
end $$;
rollback;

\echo ''
\echo '── 8. Un terapeuta no puede robar un paciente de otro ─────────────────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000002');  -- Tomás
do $$
declare n int;
begin
  update pacientes set responsable_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where apellido = 'Mamani';
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALLÓ: Tomás se apropió del paciente de Rita'; end if;
  raise notice '  ok   No puede reasignarse un paciente que no ve';
end $$;
rollback;

\echo ''
\echo '── 9. No se puede crear un paciente en otro centro ────────────────────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000002');
do $$
begin
  insert into pacientes (centro_id, nombre, apellido, fecha_nacimiento, responsable_id)
  values ('22222222-2222-2222-2222-222222222222', 'Falso', 'Intruso', '2024-01-01',
          'aaaaaaaa-0000-0000-0000-000000000002');
  raise exception 'FALLÓ: se creó un paciente en otro centro';
exception when insufficient_privilege then
  raise notice '  ok   Crear en otro centro es rechazado por RLS';
end $$;
rollback;

\echo ''
\echo '── 10. Un paciente no puede tener dos borradores abiertos ─────────────'
begin;
set local role postgres;
do $$
begin
  insert into evaluaciones (centro_id, paciente_id, examinador_id, catalogo_version,
                            fecha_pesquisa, edad_postnatal_dias, edad_corregida_dias)
  values ('11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
          'aaaaaaaa-0000-0000-0000-000000000002', 1, '2026-02-01', 700, 700);
  raise exception 'FALLÓ: se crearon dos borradores para el mismo paciente';
exception when unique_violation then
  raise notice '  ok   El segundo borrador simultáneo es rechazado';
end $$;
rollback;

\echo ''
\echo '── 11. Restricciones de datos ─────────────────────────────────────────'
begin;
set local role postgres;
do $$
begin
  insert into pacientes (centro_id, nombre, apellido, fecha_nacimiento, responsable_id)
  values ('11111111-1111-1111-1111-111111111111', 'Futuro', 'Imposible',
          current_date + 1, 'aaaaaaaa-0000-0000-0000-000000000002');
  raise exception 'FALLÓ: aceptó fecha de nacimiento futura';
exception when check_violation then
  raise notice '  ok   Rechaza fecha de nacimiento futura';
end $$;
do $$
begin
  insert into pacientes (centro_id, nombre, apellido, fecha_nacimiento,
                         edad_gestacional_sem, responsable_id)
  values ('11111111-1111-1111-1111-111111111111', 'EG', 'Absurda', '2024-01-01', 99,
          'aaaaaaaa-0000-0000-0000-000000000002');
  raise exception 'FALLÓ: aceptó edad gestacional de 99 semanas';
exception when check_violation then
  raise notice '  ok   Rechaza edad gestacional fuera de rango';
end $$;
rollback;

\echo ''
\echo '── 12. Todo movimiento queda auditado ─────────────────────────────────'
begin;
set local role postgres;
select afirmar(
  (select count(*) from auditoria where tabla = 'pacientes' and accion = 'alta') = 3,
  'Las 3 altas de pacientes quedaron en la auditoría');
select afirmar(
  (select count(*) from auditoria where tabla = 'centros' and accion = 'alta') = 2,
  'Las 2 altas de centros quedaron en la auditoría');
select afirmar(
  (select datos_despues->>'apellido' from auditoria
   where tabla = 'pacientes' and accion = 'alta'
   order by id limit 1) = 'Rojas',
  'La auditoría guarda el contenido del registro');
rollback;

\echo ''
\echo '── 13. La auditoría no se puede alterar desde la aplicación ───────────'
begin;
select pruebas_como('aaaaaaaa-0000-0000-0000-000000000001');  -- Ana, admin
do $$
declare n int;
begin
  delete from auditoria;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'FALLÓ: se borró la auditoría'; end if;
  raise notice '  ok   No se puede borrar la auditoría';
exception when insufficient_privilege then
  raise notice '  ok   Borrar la auditoría lo rechaza el permiso de tabla';
end $$;
do $$
begin
  insert into auditoria (tabla, registro_id, accion) values ('falso', 'x', 'alta');
  raise exception 'FALLÓ: se pudo insertar auditoría a mano';
exception when insufficient_privilege then
  raise notice '  ok   No se puede insertar auditoría a mano';
end $$;
rollback;

\echo ''
\echo '── 14. Un perfil no puede ser superadmin y de un centro a la vez ──────'
begin;
set local role postgres;
do $$
begin
  insert into auth.users (id, email) values ('dddddddd-0000-0000-0000-000000000001', 'raro@x.bo');
  insert into perfiles (id, nombre, email, centro_id, rol, es_superadmin)
  values ('dddddddd-0000-0000-0000-000000000001', 'Raro', 'raro@x.bo',
          '11111111-1111-1111-1111-111111111111', 'admin', true);
  raise exception 'FALLÓ: aceptó un superadmin con centro';
exception when check_violation then
  raise notice '  ok   Rechaza un perfil incoherente';
end $$;
rollback;

\echo ''
\echo '════════════════════════════════════════════════════════════════════════'
\echo '  TODAS LAS PRUEBAS DE AISLAMIENTO PASARON'
\echo '════════════════════════════════════════════════════════════════════════'

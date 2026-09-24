-- ============================================================================
--  PRUNAPE Digital · esquema base
--
--  Reglas del dominio que este esquema hace cumplir:
--   · Un terapeuta pertenece a UN solo centro y ve SOLO sus propios pacientes.
--   · El admin del centro ve todo lo de su centro.
--   · El superadmin administra la plataforma; para leer datos clínicos
--     necesita abrir un acceso de soporte, que queda registrado.
--   · Nada se borra: se archiva.
--   · Toda escritura queda auditada por trigger, no por la aplicación.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────── tipos
create type rol_centro as enum ('admin', 'terapeuta');
create type estado_evaluacion as enum ('borrador', 'cerrada');
create type accion_auditoria as enum ('alta', 'cambio', 'archivado', 'cierre', 'lectura_soporte');

-- ─────────────────────────────────────────────────────────── centros
create table centros (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  slug        text not null unique,
  activo      boolean not null default true,
  -- personalización por tenant (la edita el superadmin desde el backoffice)
  branding    jsonb not null default jsonb_build_object(
                'logo_url', null,
                'color_primario', '#2f6f4e',
                'color_acento',   '#a8c0a4'
              ),
  creado_en   timestamptz not null default now(),
  archivado_en timestamptz
);
comment on table centros is 'Inquilino (tenant). Cada centro es un espacio de datos aislado.';

-- ─────────────────────────────────────────────────────────── perfiles
-- Extiende auth.users. Un perfil pertenece a un único centro.
create table perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  email          text not null,
  centro_id      uuid references centros(id),
  rol            rol_centro,
  es_superadmin  boolean not null default false,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  -- un superadmin no pertenece a ningún centro; el resto sí
  constraint perfil_coherente check (
    (es_superadmin and centro_id is null and rol is null)
    or (not es_superadmin and centro_id is not null and rol is not null)
  )
);
create index on perfiles (centro_id);

-- ─────────────────────────────────────────────────────────── pacientes
create table pacientes (
  id                   uuid primary key default gen_random_uuid(),
  centro_id            uuid not null references centros(id),
  nombre               text not null,
  apellido             text not null,
  fecha_nacimiento     date not null,
  edad_gestacional_sem numeric(4,1),
  historia_clinica     text,
  sexo                 text check (sexo in ('F','M','X')),
  -- terapeuta responsable: define quién lo ve cuando la visibilidad es propia
  responsable_id       uuid not null references perfiles(id),
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  archivado_en         timestamptz,
  constraint nacimiento_no_futuro check (fecha_nacimiento <= current_date),
  constraint eg_plausible check (edad_gestacional_sem is null
                                 or edad_gestacional_sem between 20 and 45)
);
create index on pacientes (centro_id, responsable_id);
create index on pacientes (centro_id, apellido, nombre);
create unique index pacientes_hc_unica on pacientes (centro_id, historia_clinica)
  where historia_clinica is not null and archivado_en is null;

-- ─────────────────────────────────────────────────────────── catálogos
-- La geometría y los percentilos de los 79 ítems. Versionado: una evaluación
-- vieja se sigue viendo con el catálogo con el que se aplicó.
create table catalogos (
  version       int primary key,
  nombre        text not null,
  definicion    jsonb not null,
  vigente_desde date not null default current_date,
  creado_en     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────── evaluaciones
create table evaluaciones (
  id                  uuid primary key default gen_random_uuid(),
  centro_id           uuid not null references centros(id),
  paciente_id         uuid not null references pacientes(id),
  examinador_id       uuid not null references perfiles(id),
  catalogo_version    int  not null references catalogos(version),
  fecha_pesquisa      date not null default current_date,
  -- se guardan calculadas: si mañana cambia la regla, lo histórico no muta
  edad_postnatal_dias  int not null,
  edad_corregida_dias  int not null,
  respuestas          jsonb not null default '{}'::jsonb,  -- {item_id: 'pasa'|'no_pasa'}
  resultado           jsonb not null default '{}'::jsonb,  -- conteos + veredicto
  observaciones       text,
  estado              estado_evaluacion not null default 'borrador',
  -- Un borrador sin firmar todavía no es historia clínica: se puede descartar.
  -- No se borra la fila; se marca, y el descarte queda auditado.
  descartado_en       timestamptz,
  cerrada_en          timestamptz,
  cerrada_por         uuid references perfiles(id),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  constraint pesquisa_no_futura check (fecha_pesquisa <= current_date),
  constraint cierre_coherente check (
    (estado = 'borrador' and cerrada_en is null and cerrada_por is null)
    or (estado = 'cerrada' and cerrada_en is not null and cerrada_por is not null)
  ),
  -- una evaluación firmada no se descarta
  constraint descarte_solo_en_borrador check (
    descartado_en is null or estado = 'borrador'
  )
);
create index on evaluaciones (paciente_id, fecha_pesquisa desc);
create index on evaluaciones (centro_id, estado);
create index on evaluaciones using gin (respuestas);

-- un paciente no puede tener dos borradores abiertos a la vez
create unique index evaluaciones_un_borrador on evaluaciones (paciente_id)
  where estado = 'borrador' and descartado_en is null;

-- ─────────────────────────────────────────────────────────── acceso de soporte
create table accesos_soporte (
  id            uuid primary key default gen_random_uuid(),
  superadmin_id uuid not null references perfiles(id),
  centro_id     uuid not null references centros(id),
  motivo        text not null check (length(trim(motivo)) >= 10),
  inicio        timestamptz not null default now(),
  fin           timestamptz not null,
  revocado_en   timestamptz,
  constraint ventana_valida check (fin > inicio)
);
create index on accesos_soporte (centro_id, fin desc);

-- ─────────────────────────────────────────────────────────── auditoría
-- Solo-agregado. La escriben triggers, no la aplicación.
create table auditoria (
  id             bigserial primary key,
  ocurrido_en    timestamptz not null default now(),
  usuario_id     uuid,
  centro_id      uuid,
  tabla          text not null,
  registro_id    text not null,
  accion         accion_auditoria not null,
  datos_antes    jsonb,
  datos_despues  jsonb
);
create index on auditoria (centro_id, ocurrido_en desc);
create index on auditoria (tabla, registro_id);

-- ============================================================================
--  Funciones de contexto
-- ============================================================================

create or replace function mi_perfil()
returns perfiles language sql stable security definer set search_path = public as $$
  select * from perfiles where id = auth.uid();
$$;

create or replace function es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select es_superadmin and activo from perfiles where id = auth.uid()), false);
$$;

create or replace function mi_centro()
returns uuid language sql stable security definer set search_path = public as $$
  select centro_id from perfiles where id = auth.uid() and activo;
$$;

create or replace function soy_admin_centro()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'admin' and activo from perfiles where id = auth.uid()), false);
$$;

-- ¿el superadmin tiene una ventana de soporte abierta sobre este centro?
create or replace function soporte_abierto(p_centro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accesos_soporte
    where centro_id = p_centro and superadmin_id = auth.uid()
      and revocado_en is null and now() between inicio and fin
  );
$$;

-- Regla central de visibilidad de un paciente.
create or replace function puedo_ver_paciente(p_centro uuid, p_responsable uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    case
      when es_superadmin() then soporte_abierto(p_centro)
      when mi_centro() is distinct from p_centro then false
      when soy_admin_centro() then true
      else p_responsable = auth.uid()
    end;
$$;

-- ============================================================================
--  Auditoría por trigger
-- ============================================================================

create or replace function fn_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_accion accion_auditoria;
  v_centro uuid;
  v_id     text;
begin
  if TG_OP = 'INSERT' then
    v_accion := 'alta';
  elsif TG_OP = 'UPDATE' then
    if (to_jsonb(NEW) ? 'archivado_en'
        and (to_jsonb(OLD)->>'archivado_en') is null
        and (to_jsonb(NEW)->>'archivado_en') is not null)
    or (to_jsonb(NEW) ? 'descartado_en'
        and (to_jsonb(OLD)->>'descartado_en') is null
        and (to_jsonb(NEW)->>'descartado_en') is not null) then
      v_accion := 'archivado';
    elsif to_jsonb(NEW) ? 'estado'
       and (to_jsonb(OLD)->>'estado') is distinct from (to_jsonb(NEW)->>'estado')
       and (to_jsonb(NEW)->>'estado') = 'cerrada' then
      v_accion := 'cierre';
    else
      v_accion := 'cambio';
    end if;
  else
    -- DELETE no está permitido en estas tablas (ver política más abajo)
    raise exception 'No se permite borrar registros de %', TG_TABLE_NAME;
  end if;

  v_centro := nullif(to_jsonb(coalesce(NEW, OLD))->>'centro_id','')::uuid;
  v_id     := coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');

  insert into auditoria (usuario_id, centro_id, tabla, registro_id, accion,
                         datos_antes, datos_despues)
  values (auth.uid(), v_centro, TG_TABLE_NAME, v_id, v_accion,
          case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
          to_jsonb(NEW));
  return NEW;
end;
$$;

create trigger tg_auditar_pacientes    after insert or update or delete on pacientes
  for each row execute function fn_auditar();
create trigger tg_auditar_evaluaciones after insert or update or delete on evaluaciones
  for each row execute function fn_auditar();
create trigger tg_auditar_perfiles     after insert or update or delete on perfiles
  for each row execute function fn_auditar();
create trigger tg_auditar_centros      after insert or update or delete on centros
  for each row execute function fn_auditar();

-- actualizado_en automático
create or replace function fn_tocar()
returns trigger language plpgsql as $$
begin NEW.actualizado_en := now(); return NEW; end;
$$;
create trigger tg_tocar_pacientes    before update on pacientes
  for each row execute function fn_tocar();
create trigger tg_tocar_evaluaciones before update on evaluaciones
  for each row execute function fn_tocar();

-- Una evaluación cerrada no se edita más (salvo superadmin con soporte abierto)
create or replace function fn_evaluacion_inmutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if OLD.estado = 'cerrada' and not (es_superadmin() and soporte_abierto(OLD.centro_id)) then
    raise exception 'La evaluación ya fue cerrada y forma parte de la historia clínica';
  end if;
  if OLD.descartado_en is not null and NEW.descartado_en is not null then
    raise exception 'La evaluación fue descartada y no se puede seguir editando';
  end if;
  return NEW;
end;
$$;
create trigger tg_evaluacion_inmutable before update on evaluaciones
  for each row execute function fn_evaluacion_inmutable();

-- ============================================================================
--  Row Level Security  ·  el aislamiento entre centros vive acá, no en el código
-- ============================================================================

alter table centros         enable row level security;
alter table perfiles        enable row level security;
alter table pacientes       enable row level security;
alter table evaluaciones    enable row level security;
alter table catalogos       enable row level security;
alter table auditoria       enable row level security;
alter table accesos_soporte enable row level security;

-- centros ---------------------------------------------------------------
create policy centros_lectura on centros for select
  using (es_superadmin() or id = mi_centro());
create policy centros_escritura_super on centros for all
  using (es_superadmin()) with check (es_superadmin());

-- perfiles --------------------------------------------------------------
create policy perfiles_lectura on perfiles for select
  using (
    id = auth.uid()
    or es_superadmin()
    or (centro_id is not null and centro_id = mi_centro())
  );
create policy perfiles_alta on perfiles for insert
  with check (es_superadmin() or (soy_admin_centro() and centro_id = mi_centro()));
create policy perfiles_cambio on perfiles for update
  using (es_superadmin() or (soy_admin_centro() and centro_id = mi_centro()))
  with check (es_superadmin() or (soy_admin_centro() and centro_id = mi_centro()));

-- pacientes -------------------------------------------------------------
create policy pacientes_lectura on pacientes for select
  using (puedo_ver_paciente(centro_id, responsable_id));
create policy pacientes_alta on pacientes for insert
  with check (centro_id = mi_centro() and responsable_id = auth.uid());
create policy pacientes_cambio on pacientes for update
  using (puedo_ver_paciente(centro_id, responsable_id))
  with check (centro_id = mi_centro());

-- evaluaciones ----------------------------------------------------------
create policy evaluaciones_lectura on evaluaciones for select
  using (exists (
    select 1 from pacientes p
    where p.id = paciente_id and puedo_ver_paciente(p.centro_id, p.responsable_id)
  ));
create policy evaluaciones_alta on evaluaciones for insert
  with check (
    centro_id = mi_centro() and examinador_id = auth.uid()
    and exists (select 1 from pacientes p
                where p.id = paciente_id and puedo_ver_paciente(p.centro_id, p.responsable_id))
  );
create policy evaluaciones_cambio on evaluaciones for update
  using (exists (
    select 1 from pacientes p
    where p.id = paciente_id and puedo_ver_paciente(p.centro_id, p.responsable_id)
  ));

-- catálogos: los lee cualquier usuario autenticado; los escribe el superadmin
create policy catalogos_lectura on catalogos for select using (auth.uid() is not null);
create policy catalogos_escritura on catalogos for all
  using (es_superadmin()) with check (es_superadmin());

-- auditoría: se lee, nunca se escribe ni se borra desde la API
create policy auditoria_lectura on auditoria for select
  using (es_superadmin() or (centro_id = mi_centro() and soy_admin_centro()));

-- accesos de soporte
create policy soporte_lectura on accesos_soporte for select
  using (es_superadmin() or (centro_id = mi_centro() and soy_admin_centro()));
create policy soporte_alta on accesos_soporte for insert
  with check (es_superadmin() and superadmin_id = auth.uid());
create policy soporte_cambio on accesos_soporte for update
  using (es_superadmin() and superadmin_id = auth.uid());

-- Nadie borra nada por la API: no existe ninguna policy for delete.

-- Copa Max · ejecutar una sola vez en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.seasons (
  season_year smallint primary key check (season_year between 2000 and 2100),
  created_at timestamptz not null default now()
);
insert into public.seasons (season_year) values (2026) on conflict do nothing;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  season_year smallint not null references public.seasons(season_year) on delete cascade,
  edition smallint not null check (edition between 1 and 2),
  name text not null check (length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  unique (season_year, edition)
);
insert into public.tournaments (season_year,edition,name)
select s.season_year,1,'Torneo 1' from public.seasons s
where not exists (select 1 from public.tournaments t where t.season_year=s.season_year)
on conflict do nothing;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('team-logos','team-logos',true,5242880,array['image/png','image/jpeg','image/webp']),
       ('sponsor-logos','sponsor-logos',true,5242880,array['image/png','image/jpeg','image/webp']),
       ('team-assets','team-assets',true,8388608,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_copamax_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  season_year smallint not null default 2026 references public.seasons(season_year) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  zone text not null check (zone in ('A','B')),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  shirt_number smallint check (shirt_number between 1 and 99),
  position text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.team_profiles (
  team_id uuid primary key references public.teams(id) on delete cascade,
  slug text not null unique,
  description text not null default '', tagline text, coach_name text, coach_photo_url text, banner_url text,
  city text, founded_year smallint check (founded_year between 1800 and 2100),
  instagram_url text, facebook_url text, whatsapp text, accent_color text not null default '#09a9ef',
  profile_style text not null default 'stadium',
  updated_at timestamptz not null default now()
);
alter table public.team_profiles add column if not exists tagline text;
alter table public.team_profiles add column if not exists city text;
alter table public.team_profiles add column if not exists founded_year smallint;
alter table public.team_profiles add column if not exists instagram_url text;
alter table public.team_profiles add column if not exists facebook_url text;
alter table public.team_profiles add column if not exists whatsapp text;
alter table public.team_profiles add column if not exists accent_color text not null default '#09a9ef';
alter table public.team_profiles add column if not exists profile_style text;
update public.team_profiles set profile_style=(array['stadium','heritage','street'])[mod(abs(hashtext(team_id::text)::bigint),3)::integer+1] where profile_style is null;
alter table public.team_profiles alter column profile_style set default 'stadium';
alter table public.team_profiles alter column profile_style set not null;
create table if not exists public.team_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null unique references public.teams(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.team_staff (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100), role text not null default 'Ayudante de campo', photo_url text,
  sort_order integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.team_achievements (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 120), description text, image_url text,
  achievement_year smallint check (achievement_year between 1900 and 2100), created_at timestamptz not null default now()
);
alter table public.team_profiles add column if not exists coach_photo_url text;
alter table public.players add column if not exists photo_url text;
alter table public.team_staff add column if not exists photo_url text;
alter table public.team_achievements add column if not exists image_url text;
create table if not exists public.team_gallery (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  image_url text not null, caption text, sort_order integer not null default 0, created_at timestamptz not null default now()
);
create or replace function public.owns_team(target_team_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.team_owners where team_id=target_team_id and user_id=(select auth.uid()));
$$;
create or replace function public.ensure_team_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare base_slug text;
begin
  base_slug := trim(both '-' from regexp_replace(lower(coalesce(new.name,'club')), '[^a-z0-9]+', '-', 'g'));
  if base_slug='' then base_slug:='club'; end if;
  insert into public.team_profiles(team_id,slug,profile_style)
  values(new.id,base_slug||'-'||left(replace(new.id::text,'-',''),8),(array['stadium','heritage','street'])[mod(abs(hashtext(new.id::text)::bigint),3)::integer+1])
  on conflict(team_id) do nothing;
  return new;
end;
$$;
drop trigger if exists teams_create_profile on public.teams;
create trigger teams_create_profile after insert on public.teams for each row execute function public.ensure_team_profile();
insert into public.team_profiles(team_id,slug)
select t.id,coalesce(nullif(trim(both '-' from regexp_replace(lower(t.name),'[^a-z0-9]+','-','g')),''),'club')||'-'||left(replace(t.id::text,'-',''),8)
from public.teams t on conflict(team_id) do nothing;

-- Permite aplicar el esquema sobre la primera versión de Copa Max también.
alter table public.teams add column if not exists season_year smallint not null default 2026;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  season_year smallint not null default 2026 references public.seasons(season_year) on delete cascade,
  round integer not null check (round > 0),
  zone text not null check (zone in ('A','B','INTERZONAL')),
  scheduled_at timestamptz,
  home_team_id uuid not null references public.teams(id) on delete restrict,
  away_team_id uuid not null references public.teams(id) on delete restrict,
  home_score smallint check (home_score >= 0),
  away_score smallint check (away_score >= 0),
  venue text,
  status text generated always as (case when home_score is not null and away_score is not null then 'played' else 'scheduled' end) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint different_teams check (home_team_id <> away_team_id),
  constraint both_scores_or_none check ((home_score is null) = (away_score is null))
);
alter table public.matches add column if not exists season_year smallint not null default 2026;
alter table public.matches add column if not exists scheduled_date date;
alter table public.matches add column if not exists scheduled_time time;
update public.matches set scheduled_date=coalesce(scheduled_date,(scheduled_at at time zone 'America/Argentina/Buenos_Aires')::date), scheduled_time=coalesce(scheduled_time,(scheduled_at at time zone 'America/Argentina/Buenos_Aires')::time) where scheduled_at is not null;
alter table public.matches alter column scheduled_at drop not null;
alter table public.matches drop constraint if exists matches_zone_check;
alter table public.matches add constraint matches_zone_check check (zone in ('A','B','INTERZONAL'));
-- Al eliminar un club, también se eliminan sus partidos para no bloquear el borrado del torneo.
alter table public.matches drop constraint if exists matches_home_team_id_fkey;
alter table public.matches drop constraint if exists matches_away_team_id_fkey;
alter table public.matches add constraint matches_home_team_id_fkey foreign key (home_team_id) references public.teams(id) on delete cascade;
alter table public.matches add constraint matches_away_team_id_fkey foreign key (away_team_id) references public.teams(id) on delete cascade;

create table if not exists public.sponsors (
  id uuid primary key default gen_random_uuid(),
  season_year smallint not null default 2026 references public.seasons(season_year) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 100),
  logo_url text,
  website_url text,
  category text not null default 'SPONSOR OFICIAL',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Migra años que puedan existir en tablas de versiones anteriores.
insert into public.seasons (season_year)
select distinct season_year from (
  select season_year from public.teams
  union all select season_year from public.matches
  union all select season_year from public.sponsors
) existing_years on conflict do nothing;

insert into public.tournaments (season_year,edition,name)
select s.season_year,1,'Torneo 1' from public.seasons s
where not exists (select 1 from public.tournaments t where t.season_year=s.season_year)
on conflict do nothing;

alter table public.teams add column if not exists tournament_id uuid;
alter table public.matches add column if not exists tournament_id uuid;
alter table public.sponsors add column if not exists tournament_id uuid;
update public.teams t set tournament_id=(select id from public.tournaments x where x.season_year=t.season_year order by edition limit 1) where t.tournament_id is null;
update public.matches m set tournament_id=(select id from public.tournaments x where x.season_year=m.season_year order by edition limit 1) where m.tournament_id is null;
update public.sponsors s set tournament_id=(select id from public.tournaments x where x.season_year=s.season_year order by edition limit 1) where s.tournament_id is null;
alter table public.teams alter column tournament_id set not null;
alter table public.matches alter column tournament_id set not null;
alter table public.sponsors alter column tournament_id set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='teams_season_year_fkey') then
    alter table public.teams add constraint teams_season_year_fkey foreign key (season_year) references public.seasons(season_year) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='matches_season_year_fkey') then
    alter table public.matches add constraint matches_season_year_fkey foreign key (season_year) references public.seasons(season_year) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='sponsors_season_year_fkey') then
    alter table public.sponsors add constraint sponsors_season_year_fkey foreign key (season_year) references public.seasons(season_year) on delete cascade;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='teams_tournament_id_fkey') then alter table public.teams add constraint teams_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='matches_tournament_id_fkey') then alter table public.matches add constraint matches_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='sponsors_tournament_id_fkey') then alter table public.sponsors add constraint sponsors_tournament_id_fkey foreign key (tournament_id) references public.tournaments(id) on delete cascade; end if;
end $$;

create or replace function public.check_match_zone()
returns trigger language plpgsql set search_path = '' as $$
declare home_zone text; away_zone text; home_year smallint; away_year smallint; home_tournament uuid; away_tournament uuid;
begin
  select zone, season_year, tournament_id into home_zone, home_year, home_tournament from public.teams where id = new.home_team_id;
  select zone, season_year, tournament_id into away_zone, away_year, away_tournament from public.teams where id = new.away_team_id;
  if home_year is distinct from new.season_year or away_year is distinct from new.season_year or home_tournament is distinct from new.tournament_id or away_tournament is distinct from new.tournament_id then
    raise exception 'Both teams must belong to the same tournament';
  end if;
  if new.zone='INTERZONAL' then
    if home_zone is not distinct from away_zone then raise exception 'An interzonal match must cross zones A and B'; end if;
  elsif home_zone is distinct from new.zone or away_zone is distinct from new.zone then
    raise exception 'Both teams must belong to zone %', new.zone;
  end if;
  return new;
end;
$$;
drop trigger if exists matches_check_zone on public.matches;
create trigger matches_check_zone before insert or update of season_year, tournament_id, zone, home_team_id, away_team_id
on public.matches for each row execute function public.check_match_zone();

drop index if exists public.matches_year_zone_round_date_idx;
create index matches_year_zone_round_date_idx on public.matches(season_year, tournament_id, zone, round, scheduled_date, scheduled_time);
create index if not exists players_team_idx on public.players(team_id);
create index if not exists sponsors_year_order_idx on public.sponsors(season_year, tournament_id, display_order);

-- Copas posteriores: clasificación automática desde tabla y cuadro de partidos administrable.
create table if not exists public.tournament_scorers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null check(length(trim(player_name)) between 2 and 100),
  goals smallint not null default 0 check(goals>=0),
  created_at timestamptz not null default now(),
  unique(tournament_id,team_id,player_name)
);
create or replace function public.validate_tournament_scorer()
returns trigger language plpgsql set search_path='' as $$
declare team_tournament uuid; player_team uuid;
begin
  select tournament_id into team_tournament from public.teams where id=new.team_id;
  if team_tournament is distinct from new.tournament_id then raise exception 'El jugador y su club deben pertenecer al torneo seleccionado'; end if;
  if new.player_id is not null then
    select team_id into player_team from public.players where id=new.player_id;
    if player_team is distinct from new.team_id then raise exception 'El jugador seleccionado no pertenece a este equipo'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists tournament_scorer_validate on public.tournament_scorers;
create trigger tournament_scorer_validate before insert or update of tournament_id,team_id,player_id on public.tournament_scorers
for each row execute function public.validate_tournament_scorer();
create index if not exists tournament_scorers_rank_idx on public.tournament_scorers(tournament_id,goals desc,player_name);

create table if not exists public.postseason_cups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  cup_type text not null check (cup_type in ('ORO','PLATA')),
  champion_team_id uuid references public.teams(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tournament_id,cup_type)
);
create table if not exists public.postseason_cup_entries (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.postseason_cups(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  seed smallint not null default 0,
  created_at timestamptz not null default now(),
  unique(cup_id,team_id)
);
create table if not exists public.postseason_cup_matches (
  id uuid primary key default gen_random_uuid(),
  cup_id uuid not null references public.postseason_cups(id) on delete cascade,
  round_number smallint not null check (round_number between 1 and 3),
  match_number smallint not null check (match_number > 0),
  scheduled_date date,
  scheduled_time time,
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  home_score smallint check (home_score >= 0),
  away_score smallint check (away_score >= 0),
  winner_team_id uuid references public.teams(id) on delete set null,
  venue text,
  created_at timestamptz not null default now(),
  constraint postseason_different_teams check(home_team_id<>away_team_id),
  constraint postseason_both_scores check((home_score is null)=(away_score is null)),
  unique(cup_id,round_number,match_number)
);
alter table public.postseason_cup_matches add column if not exists winner_team_id uuid references public.teams(id) on delete set null;
create or replace function public.validate_postseason_entry()
returns trigger language plpgsql set search_path='' as $$
declare cup_tournament uuid; team_tournament uuid;
begin
  select tournament_id into cup_tournament from public.postseason_cups where id=new.cup_id;
  select tournament_id into team_tournament from public.teams where id=new.team_id;
  if cup_tournament is distinct from team_tournament then raise exception 'El equipo debe pertenecer al torneo de esta copa'; end if;
  return new;
end; $$;
drop trigger if exists postseason_entry_validate on public.postseason_cup_entries;
create trigger postseason_entry_validate before insert or update of cup_id,team_id on public.postseason_cup_entries
for each row execute function public.validate_postseason_entry();

create or replace function public.validate_postseason_match()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.postseason_cup_entries e where e.cup_id=new.cup_id and e.team_id=new.home_team_id)
     or not exists(select 1 from public.postseason_cup_entries e where e.cup_id=new.cup_id and e.team_id=new.away_team_id) then
    raise exception 'Los dos equipos deben estar clasificados a esta copa';
  end if;
  if new.winner_team_id is not null and new.winner_team_id not in (new.home_team_id,new.away_team_id) then raise exception 'El ganador debe ser uno de los equipos del cruce'; end if;
  if new.home_score is not null and new.away_score is not null and new.home_score<>new.away_score and new.winner_team_id is not null and new.winner_team_id is distinct from case when new.home_score>new.away_score then new.home_team_id else new.away_team_id end then raise exception 'El ganador indicado no coincide con el resultado'; end if;
  return new;
end; $$;
drop trigger if exists postseason_match_validate on public.postseason_cup_matches;
create trigger postseason_match_validate before insert or update of cup_id,home_team_id,away_team_id,home_score,away_score,winner_team_id on public.postseason_cup_matches
for each row execute function public.validate_postseason_match();

create or replace function public.refresh_postseason_champion()
returns trigger language plpgsql set search_path='' as $$
declare affected_cup uuid; winner uuid;
begin
  if tg_op='DELETE' then affected_cup=old.cup_id; else affected_cup=new.cup_id; end if;
  select case when m.home_score>m.away_score then m.home_team_id when m.away_score>m.home_score then m.away_team_id else m.winner_team_id end into winner
  from public.postseason_cup_matches m where m.cup_id=affected_cup and m.round_number=3 and m.match_number=1 and m.home_score is not null and m.away_score is not null;
  update public.postseason_cups set champion_team_id=winner where id=affected_cup;
  if tg_op='UPDATE' and old.cup_id is distinct from new.cup_id then
    select case when m.home_score>m.away_score then m.home_team_id when m.away_score>m.home_score then m.away_team_id else m.winner_team_id end into winner
    from public.postseason_cup_matches m where m.cup_id=old.cup_id and m.round_number=3 and m.match_number=1 and m.home_score is not null and m.away_score is not null;
    update public.postseason_cups set champion_team_id=winner where id=old.cup_id;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end; $$;
drop trigger if exists postseason_champion_refresh on public.postseason_cup_matches;
create trigger postseason_champion_refresh after insert or update or delete on public.postseason_cup_matches
for each row execute function public.refresh_postseason_champion();
create index if not exists postseason_cups_tournament_idx on public.postseason_cups(tournament_id,cup_type);
create index if not exists postseason_cup_entries_cup_idx on public.postseason_cup_entries(cup_id,seed);
create index if not exists postseason_cup_matches_cup_idx on public.postseason_cup_matches(cup_id,round_number,match_number);

-- Se actualiza sola al editar partidos. El frontend puede consultar esta vista.
drop view if exists public.standings;
create view public.standings with (security_invoker = true) as
with team_results as (
  select t.id as team_id, t.name, t.season_year, t.tournament_id, t.zone, t.logo_url,
    count(m.id) filter (where m.home_score is not null)::integer as played,
    count(m.id) filter (where m.home_score > m.away_score)::integer as won,
    count(m.id) filter (where m.home_score = m.away_score and m.home_score is not null)::integer as drawn,
    count(m.id) filter (where m.home_score < m.away_score)::integer as lost,
    coalesce(sum(m.home_score) filter (where m.home_score is not null),0)::integer as goals_for,
    coalesce(sum(m.away_score) filter (where m.home_score is not null),0)::integer as goals_against
  from public.teams t left join public.matches m on m.home_team_id=t.id and m.season_year=t.season_year and m.tournament_id=t.tournament_id
  group by t.id
  union all
  select t.id, t.name, t.season_year, t.tournament_id, t.zone, t.logo_url,
    count(m.id) filter (where m.away_score is not null)::integer,
    count(m.id) filter (where m.away_score > m.home_score)::integer,
    count(m.id) filter (where m.away_score = m.home_score and m.away_score is not null)::integer,
    count(m.id) filter (where m.away_score < m.home_score)::integer,
    coalesce(sum(m.away_score) filter (where m.away_score is not null),0)::integer,
    coalesce(sum(m.home_score) filter (where m.away_score is not null),0)::integer
  from public.teams t left join public.matches m on m.away_team_id=t.id and m.season_year=t.season_year and m.tournament_id=t.tournament_id
  group by t.id
), totals as (
  select team_id,name,season_year,tournament_id,zone,logo_url,sum(played)::integer played,sum(won)::integer won,
    sum(drawn)::integer drawn,sum(lost)::integer lost,sum(goals_for)::integer goals_for,
  sum(goals_against)::integer goals_against
  from team_results group by team_id,name,season_year,tournament_id,zone,logo_url
)
select *, goals_for-goals_against as goal_difference, won*3+drawn as points,
  row_number() over (partition by tournament_id, zone order by won*3+drawn desc, goals_for-goals_against desc, goals_for desc, name) as position
from totals;

-- Público: lectura de equipos, jugadores y calendario. Escritura: usuarios cargados en admins.
alter table public.admins enable row level security;
alter table public.seasons enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sponsors enable row level security;
alter table public.team_profiles enable row level security;
alter table public.team_owners enable row level security;
alter table public.team_staff enable row level security;
alter table public.team_achievements enable row level security;
alter table public.team_gallery enable row level security;
alter table public.tournament_scorers enable row level security;
alter table public.postseason_cups enable row level security;
alter table public.postseason_cup_entries enable row level security;
alter table public.postseason_cup_matches enable row level security;

drop policy if exists "admins can read admin list" on public.admins;
create policy "admins can read admin list" on public.admins for select to authenticated using (public.is_copamax_admin());
drop policy if exists "public can read seasons" on public.seasons;
create policy "public can read seasons" on public.seasons for select to anon, authenticated using (true);
drop policy if exists "admins manage seasons" on public.seasons;
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read tournaments" on public.tournaments;
create policy "public can read tournaments" on public.tournaments for select to anon, authenticated using (true);
drop policy if exists "admins manage tournaments" on public.tournaments;
create policy "admins manage tournaments" on public.tournaments for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read tournament scorers" on public.tournament_scorers;
create policy "public can read tournament scorers" on public.tournament_scorers for select to anon,authenticated using (true);
drop policy if exists "admins manage tournament scorers" on public.tournament_scorers;
create policy "admins manage tournament scorers" on public.tournament_scorers for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read postseason cups" on public.postseason_cups;
create policy "public can read postseason cups" on public.postseason_cups for select to anon,authenticated using (true);
drop policy if exists "admins manage postseason cups" on public.postseason_cups;
create policy "admins manage postseason cups" on public.postseason_cups for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read postseason cup entries" on public.postseason_cup_entries;
create policy "public can read postseason cup entries" on public.postseason_cup_entries for select to anon,authenticated using (true);
drop policy if exists "admins manage postseason cup entries" on public.postseason_cup_entries;
create policy "admins manage postseason cup entries" on public.postseason_cup_entries for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read postseason cup matches" on public.postseason_cup_matches;
create policy "public can read postseason cup matches" on public.postseason_cup_matches for select to anon,authenticated using (true);
drop policy if exists "admins manage postseason cup matches" on public.postseason_cup_matches;
create policy "admins manage postseason cup matches" on public.postseason_cup_matches for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read teams" on public.teams;
create policy "public can read teams" on public.teams for select to anon, authenticated using (true);
drop policy if exists "admins manage teams" on public.teams;
create policy "admins manage teams" on public.teams for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read players" on public.players;
create policy "public can read players" on public.players for select to anon, authenticated using (true);
drop policy if exists "admins manage players" on public.players;
create policy "admins manage players" on public.players for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read matches" on public.matches;
create policy "public can read matches" on public.matches for select to anon, authenticated using (true);
drop policy if exists "admins manage matches" on public.matches;
create policy "admins manage matches" on public.matches for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());
drop policy if exists "public can read active sponsors" on public.sponsors;
create policy "public can read active sponsors" on public.sponsors for select to anon, authenticated using (is_active = true);
drop policy if exists "admins manage sponsors" on public.sponsors;
create policy "admins manage sponsors" on public.sponsors for all to authenticated using (public.is_copamax_admin()) with check (public.is_copamax_admin());

drop policy if exists "public can read team profiles" on public.team_profiles;
create policy "public can read team profiles" on public.team_profiles for select to anon,authenticated using (true);
drop policy if exists "owners and admins manage profiles" on public.team_profiles;
create policy "owners and admins manage profiles" on public.team_profiles for all to authenticated using (public.is_copamax_admin() or public.owns_team(team_id)) with check (public.is_copamax_admin() or public.owns_team(team_id));
drop policy if exists "public can read team staff" on public.team_staff;
create policy "public can read team staff" on public.team_staff for select to anon,authenticated using (true);
drop policy if exists "owners and admins manage staff" on public.team_staff;
create policy "owners and admins manage staff" on public.team_staff for all to authenticated using (public.is_copamax_admin() or public.owns_team(team_id)) with check (public.is_copamax_admin() or public.owns_team(team_id));
drop policy if exists "public can read team achievements" on public.team_achievements;
create policy "public can read team achievements" on public.team_achievements for select to anon,authenticated using (true);
drop policy if exists "owners and admins manage achievements" on public.team_achievements;
create policy "owners and admins manage achievements" on public.team_achievements for all to authenticated using (public.is_copamax_admin() or public.owns_team(team_id)) with check (public.is_copamax_admin() or public.owns_team(team_id));
drop policy if exists "public can read team gallery" on public.team_gallery;
create policy "public can read team gallery" on public.team_gallery for select to anon,authenticated using (true);
drop policy if exists "owners and admins manage team gallery" on public.team_gallery;
create policy "owners and admins manage team gallery" on public.team_gallery for all to authenticated using (public.is_copamax_admin() or public.owns_team(team_id)) with check (public.is_copamax_admin() or public.owns_team(team_id));
drop policy if exists "owners can read own team access" on public.team_owners;
create policy "owners can read own team access" on public.team_owners for select to authenticated using (user_id=(select auth.uid()) or public.is_copamax_admin());
drop policy if exists "team owners manage own players" on public.players;
create policy "team owners manage own players" on public.players for all to authenticated using (public.owns_team(team_id)) with check (public.owns_team(team_id));
drop policy if exists "team owners update own team" on public.teams;
create policy "team owners update own team" on public.teams for update to authenticated using (public.owns_team(id)) with check (public.owns_team(id));

drop policy if exists "public can view Copa Max team logos" on storage.objects;
create policy "public can view Copa Max team logos" on storage.objects for select to anon, authenticated using (bucket_id in ('team-logos','sponsor-logos'));
drop policy if exists "admins manage Copa Max team logos" on storage.objects;
create policy "admins manage Copa Max team logos" on storage.objects for all to authenticated using (bucket_id in ('team-logos','sponsor-logos') and public.is_copamax_admin()) with check (bucket_id in ('team-logos','sponsor-logos') and public.is_copamax_admin());
drop policy if exists "public can view club profile images" on storage.objects;
create policy "public can view club profile images" on storage.objects for select to anon,authenticated using (bucket_id='team-assets');
drop policy if exists "club owners manage own profile images" on storage.objects;
create policy "club owners manage own profile images" on storage.objects for all to authenticated using (bucket_id='team-assets' and (public.is_copamax_admin() or public.owns_team(((storage.foldername(name))[1])::uuid))) with check (bucket_id='team-assets' and (public.is_copamax_admin() or public.owns_team(((storage.foldername(name))[1])::uuid)));

grant select on public.seasons, public.tournaments, public.teams, public.players, public.matches, public.sponsors, public.standings to anon, authenticated;
grant insert, update, delete on public.seasons, public.tournaments, public.teams, public.players, public.matches, public.sponsors to authenticated;
grant select on public.admins to authenticated;
grant select,insert,update,delete on public.team_profiles,public.team_staff,public.team_achievements,public.team_gallery to authenticated;
grant select on public.team_profiles,public.team_staff,public.team_achievements,public.team_gallery to anon,authenticated;
grant select on public.postseason_cups,public.postseason_cup_entries,public.postseason_cup_matches to anon,authenticated;
grant select,insert,update,delete on public.postseason_cups,public.postseason_cup_entries,public.postseason_cup_matches to authenticated;
grant select on public.tournament_scorers to anon,authenticated;
grant select,insert,update,delete on public.tournament_scorers to authenticated;
grant select on public.team_owners to authenticated;

-- Después de crear la cuenta desde Supabase Auth, promoverla así:
-- insert into public.admins (user_id)
-- select id from auth.users where email = 'tu-correo@ejemplo.com';

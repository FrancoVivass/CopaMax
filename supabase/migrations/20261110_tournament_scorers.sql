-- Ejecutar en Supabase SQL Editor para habilitar la tabla de goleadores.
create table if not exists public.tournament_scorers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  player_name text not null check (length(trim(player_name)) between 2 and 100),
  goals smallint not null default 0 check (goals >= 0),
  created_at timestamptz not null default now(),
  unique (tournament_id, team_id, player_name)
);

create or replace function public.validate_tournament_scorer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  team_tournament uuid;
  player_team uuid;
begin
  select tournament_id into team_tournament
  from public.teams where id = new.team_id;
  if team_tournament is distinct from new.tournament_id then
    raise exception 'El jugador y su club deben pertenecer al torneo seleccionado';
  end if;

  if new.player_id is not null then
    select team_id into player_team from public.players where id = new.player_id;
    if player_team is distinct from new.team_id then
      raise exception 'El jugador seleccionado no pertenece a este equipo';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tournament_scorer_validate on public.tournament_scorers;
create trigger tournament_scorer_validate
before insert or update of tournament_id, team_id, player_id
on public.tournament_scorers
for each row execute function public.validate_tournament_scorer();

create index if not exists tournament_scorers_rank_idx
  on public.tournament_scorers (tournament_id, goals desc, player_name);

alter table public.tournament_scorers enable row level security;
drop policy if exists "public can read tournament scorers" on public.tournament_scorers;
create policy "public can read tournament scorers"
  on public.tournament_scorers for select to anon, authenticated using (true);
drop policy if exists "admins manage tournament scorers" on public.tournament_scorers;
create policy "admins manage tournament scorers"
  on public.tournament_scorers for all to authenticated
  using (public.is_copamax_admin()) with check (public.is_copamax_admin());

grant select on public.tournament_scorers to anon, authenticated;
grant insert, update, delete on public.tournament_scorers to authenticated;
notify pgrst, 'reload schema';

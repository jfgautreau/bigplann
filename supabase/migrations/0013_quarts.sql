-- =====================================================================
-- Migration 0013 - Phase 1 : Quarts (Matin/Apres-midi/Nuit), rotation,
-- ouverture des lignes par quart. ADDITIF : ne touche pas ligne_ouverture /
-- jour_equipe / placement / horaire_poste (migres en Phase 2/3).
-- A executer dans le SQL Editor APRES 0012.
-- =====================================================================

-- Reference des quarts + horaires par defaut.
create table if not exists public.quart (
  code   text primary key,
  libelle text not null,
  ordre   int not null,
  debut   time,
  fin     time
);
insert into public.quart (code, libelle, ordre, debut, fin) values
  ('matin', 'Matin', 1, '06:00', '14:00'),
  ('apres_midi', 'Apres-midi', 2, '14:00', '22:00'),
  ('nuit', 'Nuit', 3, '22:00', '06:00')
on conflict (code) do nothing;

-- Rotation : quel quart fait chaque equipe une semaine donnee (lundi).
create table if not exists public.equipe_quart_semaine (
  equipe_id  uuid not null references public.equipe (id) on delete cascade,
  semaine    date not null,
  quart_code text not null references public.quart (code),
  primary key (equipe_id, semaine)
);

-- Activation d'un quart par jour (ex. nuit on/off).
create table if not exists public.jour_quart (
  jour       date not null,
  quart_code text not null references public.quart (code),
  actif      boolean not null default true,
  primary key (jour, quart_code)
);

-- Ouverture des lignes par (jour, ligne, quart). Defaut OUVERT.
create table if not exists public.ouverture_quart (
  jour       date not null,
  ligne_id   uuid not null references public.ligne (id) on delete cascade,
  quart_code text not null references public.quart (code),
  ouverte    boolean not null default true,
  primary key (jour, ligne_id, quart_code)
);

-- updated_at non necessaire ici (tables de configuration simples).

-- RLS : lecture authentifiee ; ecriture admin ou ordo.
do $$
declare t text;
begin
  foreach t in array array['quart','equipe_quart_semaine','jour_quart','ouverture_quart'] loop
    execute format('alter table public.%1$s enable row level security;', t);
    execute format('drop policy if exists %1$s_select on public.%1$s;', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists %1$s_modify on public.%1$s;', t);
    execute format('create policy %1$s_modify on public.%1$s for all to authenticated
                    using (public.is_admin() or public.has_role(''ordo''))
                    with check (public.is_admin() or public.has_role(''ordo''));', t);
  end loop;
end $$;

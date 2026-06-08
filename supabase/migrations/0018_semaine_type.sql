-- =====================================================================
-- Migration 0018 - Semaine type (gabarit de quarts actifs par jour de
-- semaine). Remplace les valeurs codees en dur (dimanche ferme, nuit
-- fermee) par une configuration modifiable. Sert de defaut "auto-load"
-- quand aucune ligne jour_quart explicite n'existe, et de reference pour
-- le bouton "Reinitialiser la semaine".
-- A executer dans le SQL Editor APRES 0017.
-- jour_semaine : 0 = lundi ... 6 = dimanche.
-- =====================================================================

create table if not exists public.semaine_type_quart (
  quart_code   text not null references public.quart (code) on delete cascade,
  jour_semaine smallint not null check (jour_semaine between 0 and 6),
  actif        boolean not null default true,
  primary key (quart_code, jour_semaine)
);

-- RLS : lecture authentifiee ; ecriture admin ou ordo (comme jour_quart).
alter table public.semaine_type_quart enable row level security;
drop policy if exists semaine_type_quart_select on public.semaine_type_quart;
create policy semaine_type_quart_select on public.semaine_type_quart
  for select to authenticated using (true);
drop policy if exists semaine_type_quart_modify on public.semaine_type_quart;
create policy semaine_type_quart_modify on public.semaine_type_quart
  for all to authenticated
  using (public.is_admin() or public.has_role('ordo'))
  with check (public.is_admin() or public.has_role('ordo'));

-- Reprise : reproduit le defaut historique (dimanche ferme, nuit fermee,
-- matin/apres-midi ouverts du lundi au samedi).
insert into public.semaine_type_quart (quart_code, jour_semaine, actif)
select q.code, g.j,
       case
         when g.j = 6 then false             -- dimanche ferme
         when q.code = 'nuit' then false      -- nuit fermee par defaut
         else true
       end
from public.quart q
cross join generate_series(0, 6) as g(j)
on conflict (quart_code, jour_semaine) do nothing;

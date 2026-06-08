-- =====================================================================
-- Migration 0021 - Lot C : quart journee, equipe.quart_fixe, categorie de
-- poste (manager/conducteur/operateur), activation poste x quart, horaires
-- specifiques (exceptions par personne x jour).
-- A executer dans le SQL Editor APRES 0020.
-- =====================================================================

-- 1. Quart "journee" (regulier). Ordre 0 pour l'afficher en tete.
insert into public.quart (code, libelle, ordre, debut, fin) values
  ('journee', 'Journée', 0, '08:00', '16:00')
on conflict (code) do nothing;

-- 2. Quart fixe d'une equipe (NULL = tourne normalement via la rotation).
alter table public.equipe
  add column if not exists quart_fixe text references public.quart (code);

-- 3. Categorie de poste : manager / conducteur / operateur.
alter table public.poste
  add column if not exists categorie text not null default 'operateur'
    check (categorie in ('manager', 'conducteur', 'operateur'));

-- Reprise depuis l'existant : conducteurs, puis managers (ex-"Chef d'equipe").
update public.poste set categorie = 'conducteur'
  where est_conducteur = true and categorie = 'operateur';
update public.poste p set categorie = 'manager'
  from public.ligne l
  where p.ligne_id = l.id
    and p.categorie <> 'conducteur'
    and (upper(btrim(l.nom)) = 'CE' or p.nom ~* '(^ce\y|chef)');

-- 4. Activation poste x quart. Defaut = actif : une ligne ne sert qu'a DESACTIVER.
create table if not exists public.poste_quart (
  poste_id   uuid not null references public.poste (id) on delete cascade,
  quart_code text not null references public.quart (code),
  actif      boolean not null default true,
  primary key (poste_id, quart_code)
);
alter table public.poste_quart enable row level security;
drop policy if exists poste_quart_select on public.poste_quart;
create policy poste_quart_select on public.poste_quart
  for select to authenticated using (true);
drop policy if exists poste_quart_modify on public.poste_quart;
create policy poste_quart_modify on public.poste_quart
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 5. Horaires specifiques (exceptions par personne et par jour). Motif optionnel.
create table if not exists public.horaire_exception (
  id          uuid primary key default gen_random_uuid(),
  personne_id uuid not null references public.personne (id) on delete cascade,
  jour        date not null,
  debut       text,
  fin         text,
  motif       text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  unique (personne_id, jour)
);
create index if not exists horaire_exception_jour_idx on public.horaire_exception (jour);
alter table public.horaire_exception enable row level security;
drop policy if exists horaire_exception_select on public.horaire_exception;
create policy horaire_exception_select on public.horaire_exception
  for select to authenticated using (true);
drop policy if exists horaire_exception_modify on public.horaire_exception;
create policy horaire_exception_modify on public.horaire_exception
  for all to authenticated
  using (public.can_edit_personne(personne_id))
  with check (public.can_edit_personne(personne_id));

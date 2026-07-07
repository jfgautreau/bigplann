-- 0027 : statut "restriction" (medicale / physique) dans la matrice de polyvalence.
-- La restriction est stockee comme niveau = -1 (en plus de l'echelle 0..4).
-- On elargit donc la contrainte de niveau sur niveau_actuel et niveau_cible.
alter table public.matrice drop constraint if exists matrice_niveau_actuel_check;
alter table public.matrice drop constraint if exists matrice_niveau_cible_check;
alter table public.matrice add constraint matrice_niveau_actuel_check check (niveau_actuel between -1 and 4);
alter table public.matrice add constraint matrice_niveau_cible_check check (niveau_cible between -1 and 4);

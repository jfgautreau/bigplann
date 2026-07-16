-- =====================================================================
-- 0033 : numero de rotation tenu par la personne sur son poste.
-- =====================================================================

-- poste.numero_rotation (0032) enumere les numeros d'un poste (« 12, 15-17 ») ;
-- on memorise ici lequel la personne occupe. NULL = placee sur le poste sans
-- numero precis (poste non numerote, ou effectif au-dela des numeros saisis).
alter table public.placement add column if not exists numero_rotation text;

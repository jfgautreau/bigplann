-- 0054 — Champ commentaire libre sur les habilitations.
--
-- Une habilitation peut porter une note : precisions apportees en formation,
-- reserve du formateur, numero d'autorisation delivree, etc. On stocke ce
-- texte a plat sur personne_competence : il vit avec la ligne, il est mis a
-- jour ou efface au meme rythme, et il apparait dans la colonne dediee de la
-- vue liste + dans le tooltip de la grille.

alter table public.personne_competence
  add column if not exists commentaire text;

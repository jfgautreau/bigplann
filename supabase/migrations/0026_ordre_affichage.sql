-- 0026 : ordre d'affichage parametrable (TV / impression PDF)
-- N° d'affichage sur les lignes et les postes. Defaut 0 -> tri secondaire par nom.
alter table ligne add column if not exists ordre_affichage integer not null default 0;
alter table poste add column if not exists ordre_affichage integer not null default 0;

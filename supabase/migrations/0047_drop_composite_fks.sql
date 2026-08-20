-- =====================================================================
-- Migration 0047 - DROP composite FKs (incompatibles avec les embeds PostgREST)
--
-- CONSTAT
-- La 0043 §G a pose des composite FKs (child.parent_id, child.site_id)
-- → parent(id, site_id) pour garantir a la base qu'aucune ligne enfant
-- ne pouvait pointer vers un parent d'un autre site.
--
-- La 0046 a ajoute EN PLUS les FKs simples pour PostgREST (embeds
-- automatiques). Consequence non anticipee : PostgREST voit desormais
-- DEUX relations entre chaque paire de tables et refuse l'embed sans
-- hint explicite, avec l'erreur « Could not embed because more than
-- one relationship was found ». Supabase JS ne remonte pas ca en throw,
-- il renvoie `data: null` silencieusement — Referentiel, Ordonnancement,
-- Personnel, Placement s'affichent vides.
--
-- CHOIX (2026-08-20)
-- On retire les composite FKs. Les FKs simples restent, PostgREST voit
-- une seule relation par paire, les embeds fonctionnent. La garantie
-- « aucun mélange inter-sites » est toujours assuree par :
--   (a) la RLS filtre chaque lecture/ecriture par site_id
--   (b) le trigger set_site_id_from_context pose site_id automatiquement
--   (c) les tests cross-site (PR 5) verifient qu'aucune query n'en
--       oublie.
-- La composite FK etait une ceinture en plus des bretelles. Les
-- bretelles restent solides.
--
-- Doc mise a jour : tasks/multi-site.md §3.4 explique le trade-off pour V2.
--
-- A executer dans le SQL Editor APRES 0046.
-- =====================================================================

do $$
declare
  c record;
begin
  for c in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where conname like '%_site_fkey' and contype = 'f'
      and connamespace = 'public'::regnamespace
    order by conname
  loop
    begin
      execute format('alter table %s drop constraint if exists %I;', c.tbl, c.conname);
      raise notice '§0047 DROP composite FK OK : % on %', c.conname, c.tbl;
    exception when others then
      raise warning '§0047 DROP composite FK ECHEC : % on % — % (%)',
        c.conname, c.tbl, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

-- On DROP aussi les contraintes unique(id, site_id) posees pour les
-- composite FKs : elles ne servent plus a rien. Postgres les gardait
-- comme index utilisables, mais un unique(id) existe deja (PK) et il
-- couvre les besoins de recherche.
do $$
declare
  c record;
begin
  for c in
    select conname, conrelid::regclass as tbl
    from pg_constraint
    where conname like '%_id_site_unique' and contype = 'u'
      and connamespace = 'public'::regnamespace
    order by conname
  loop
    begin
      execute format('alter table %s drop constraint if exists %I;', c.tbl, c.conname);
      raise notice '§0047 DROP unique(id, site_id) OK : % on %', c.conname, c.tbl;
    exception when others then
      raise warning '§0047 DROP unique(id, site_id) ECHEC : % on % — % (%)',
        c.conname, c.tbl, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

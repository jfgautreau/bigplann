-- =====================================================================
-- Migration 0046 - FKs simples restaurees pour PostgREST (embeds)
--
-- CONSTAT
-- La 0043 §G a remplace les FKs simples (ex. placement.personne_id →
-- personne(id)) par des composite FKs (personne_id, site_id) →
-- personne(id, site_id) pour garantir qu'aucune ligne enfant ne peut
-- pointer vers un parent d'un autre site.
--
-- Effet de bord decouvert ce jour : PostgREST utilise les FKs pour
-- resoudre les embeds automatiques (syntaxe SELECT "personne:personne_id(...)").
-- Avec une composite FK il ne trouve plus la relation et rejette la
-- requete avec « Could not find a relationship between X and Y in the
-- schema cache ». Consequences visibles :
--   - Habilitations : erreur 500.
--   - Planning : ecran vide (embed silencieusement remplace par null).
--   - Ordonnancement : plus de lignes affichees.
--
-- CORRECTION
-- On restaure les FKs simples (nom historique <table>_<col>_fkey) EN
-- PLUS des composites. PostgreSQL accepte deux FKs sur la meme colonne :
-- elles agissent independamment. PostgREST retrouve la relation simple
-- pour ses embeds ; les composites gardent la garantie d'integrite
-- inter-sites (ceinture + bretelles au niveau base).
--
-- Chaque ADD CONSTRAINT est encapsule dans un DO block tolerant :
-- duplication (42710) → skip, colonne absente (42703) → warning, table
-- absente (42P01) → warning. La migration reste rejouable.
--
-- A executer dans le SQL Editor APRES 0045.
-- =====================================================================

do $$
declare
  fks record;
  v_name text;
begin
  for fks in
    select * from (values
      ('ligne',                     'atelier_id',    'atelier',              'cascade'),
      ('poste',                     'ligne_id',      'ligne',                'cascade'),
      ('personne',                  'equipe_id',     'equipe',               'set null'),
      ('equipe_chef',               'equipe_id',     'equipe',               'cascade'),
      ('matrice',                   'personne_id',   'personne',             'cascade'),
      ('matrice',                   'poste_id',      'poste',                'cascade'),
      ('personne_competence',       'personne_id',   'personne',             'cascade'),
      ('poste_competence_requise',  'poste_id',      'poste',                'cascade'),
      ('horaire_poste',             'poste_id',      'poste',                'cascade'),
      ('horaire_exception',         'personne_id',   'personne',             'cascade'),
      ('poste_quart',               'poste_id',      'poste',                'cascade'),
      ('ligne_ouverture',           'ligne_id',      'ligne',                'cascade'),
      ('jour_equipe',               'equipe_id',     'equipe',               'cascade'),
      ('equipe_quart_semaine',      'equipe_id',     'equipe',               'cascade'),
      ('ouverture_quart',           'ligne_id',      'ligne',                'cascade'),
      ('semaine_type_quart',        'profil_id',     'semaine_type_profil',  'cascade'),
      ('semaine_type_ouverture',    'profil_id',     'semaine_type_profil',  'cascade'),
      ('semaine_type_ouverture',    'ligne_id',      'ligne',                'cascade'),
      ('rotation_reference',        'equipe_id',     'equipe',               'cascade'),
      ('placement',                 'personne_id',   'personne',             'cascade'),
      ('placement',                 'equipe_id',     'equipe',               'set null'),
      ('placement',                 'poste_id',      'poste',                'set null'),
      ('placement',                 'absence_id',    'absence',              'cascade'),
      ('absence',                   'personne_id',   'personne',             'cascade'),
      ('contrat_periode',           'personne_id',   'personne',             'cascade')
    ) as t(child_table, child_col, parent_table, on_delete)
  loop
    v_name := fks.child_table || '_' || fks.child_col || '_fkey';
    begin
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I (id) on delete %s;',
        fks.child_table, v_name, fks.child_col, fks.parent_table, fks.on_delete
      );
      raise notice '§0046 FK simple OK : %.% -> %', fks.child_table, fks.child_col, fks.parent_table;
    exception
      when duplicate_object then
        raise notice '§0046 FK simple deja presente sur %.% (skip)', fks.child_table, fks.child_col;
      when undefined_column then
        raise warning '§0046 FK simple ECHEC (colonne absente) : %.% — %', fks.child_table, fks.child_col, sqlerrm;
      when undefined_table then
        raise warning '§0046 FK simple ECHEC (table absente) : %.% — %', fks.child_table, fks.child_col, sqlerrm;
      when others then
        raise warning '§0046 FK simple ECHEC : %.% — % (%)', fks.child_table, fks.child_col, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

-- Force PostgREST a recharger son schema cache immediatement plutot que
-- d'attendre le TTL par defaut (~10 min). Sinon les embeds continueront
-- de rater le temps que le cache se rafraichisse.
notify pgrst, 'reload schema';

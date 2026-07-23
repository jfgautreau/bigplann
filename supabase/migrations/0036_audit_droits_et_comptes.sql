-- =====================================================================
-- Migration 0036 - Journal d'audit sur les comptes et les droits,
--                  + fermeture par defaut des profils crees automatiquement.
--
-- CONSTAT
-- Le trigger d'audit n'etait pose que sur 13 tables sur 32. Il manquait
-- notamment sur `app_user` et `role_permission` : changer un role, s'accorder
-- un droit ou desactiver un compte ne laissait AUCUNE trace, alors que
-- l'application tient un journal consultable par le CODIR. C'est ce qui
-- rendait une escalade de privileges indetectable a posteriori.
--
-- POURQUOI IL FALLAIT D'ABORD CORRIGER LE TRIGGER
-- `audit_trigger()` lisait `(new).id`. En PL/pgSQL, lire un champ absent d'un
-- record leve une erreur (« record new has no field id ») : poser le trigger
-- sur `role_permission`, dont la cle est (role, module) et qui n'a PAS de
-- colonne `id`, aurait fait echouer toute ecriture de droits. On passe donc
-- par `to_jsonb(...)->>'id'`, qui rend NULL au lieu de lever, avec un repli
-- sur les cles primaires reellement utilisees.
--
-- A executer dans le SQL Editor APRES 0035.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. Trigger d'audit tolerant aux tables sans colonne `id`
--    (reprend le repli d'auteur de la migration 0031, inchange)
-- ------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_ref jsonb; v_id text; v_actor uuid;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old); v_new := null;
  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old); v_new := to_jsonb(new);
  else
    v_old := null; v_new := to_jsonb(new);
  end if;
  v_ref := coalesce(v_new, v_old);

  -- Identifiant de la ligne : `id` quand il existe, sinon la cle primaire
  -- reelle de la table. Aucun acces direct a un champ -> aucune erreur
  -- possible sur une table a cle composite.
  v_id := coalesce(
    v_ref->>'id',
    v_ref->>'user_id',                                            -- app_user
    nullif(concat_ws(':', v_ref->>'role', v_ref->>'module'), ':') -- role_permission
  );

  -- Auteur : la session si presente ; sinon repli sur les colonnes d'auteur de la
  -- ligne (ecritures service_role, ou auth.uid() vaut NULL).
  v_actor := auth.uid();
  if v_actor is null then
    v_actor := nullif(coalesce(
      v_new->>'created_by', v_new->>'auteur_app_user_id',
      v_old->>'created_by', v_old->>'auteur_app_user_id'
    ), '')::uuid;
  end if;

  insert into public.audit_log (app_user_id, action, table_name, record_id, old_values, new_values)
  values (v_actor, tg_op, tg_table_name, v_id, v_old, v_new);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;

-- ------------------------------------------------------------------
-- 2. Audit des comptes, des droits et du parametrage
--
-- Volontairement EXCLUES : `ouverture_quart`, `jour_quart`, `ligne_ouverture`,
-- `jour_equipe`. Ce sont des tables operationnelles ecrites par centaines de
-- lignes a chaque initialisation de semaine ; les auditer noierait le journal
-- sous du bruit sans valeur (l'ordonnancement se relit a l'ecran).
-- ------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'app_user',                  -- qui change quel role, qui active/desactive
    'role_permission',           -- qui accorde quel droit
    'quart',
    'rotation_reference',
    'agence_interim',
    'competence_niveau_libelle',
    'poste_competence_requise',
    'poste_quart',
    'horaire_poste',
    'semaine_type_profil'
  ] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s;', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger();', t);
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 3. Fermeture par defaut des profils crees automatiquement
--
-- `handle_new_user` inserait un profil ACTIF de role 'codir', qui accorde la
-- lecture sur le personnel, la matrice, le planning et les bilans. Le trigger
-- se declenche sur toute insertion dans auth.users : si l'inscription publique
-- du projet Supabase etait ouverte, n'importe qui obtenait cet acces.
-- L'inscription a ete fermee cote Supabase le 23/07/2026 ; on ajoute ici la
-- ceinture : le profil naît INACTIF et ne peut rien faire.
--
-- `/api/users/create` pose desormais explicitement is_active = true apres avoir
-- verifie le droit de l'appelant. Un compte cree autrement reste inerte jusqu'a
-- ce qu'un titulaire du droit « utilisateurs » l'active.
-- ------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_user (user_id, email, name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'codir',
    false          -- fermeture par defaut : un admin active explicitement
  )
  on conflict (user_id) do nothing;
  return new;
end; $$;

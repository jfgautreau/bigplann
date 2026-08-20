-- =====================================================================
-- Migration 0045 - audit_trigger : retablit le repli sur cles non-`id`
--
-- CONSTAT
-- La 0043 §K a redefini `audit_trigger()` pour ajouter `site_id` et
-- `impersonated_by` — mais elle a ecrit `(new).id::text`, PERDANT le fix
-- de la 0036 qui gerait les tables sans colonne `id` (app_user avec
-- user_id, role_permission avec cle composite). Consequence : toute
-- ecriture sur `app_user` echoue avec « column "id" not found in data
-- type app_user » (releve ce jour en essayant de se promouvoir super
-- admin).
--
-- CORRECTION
-- Reprend le pattern tolerant de la 0036 (`to_jsonb(...)->>id` avec
-- coalesce sur user_id et cle composite (role, module)), en gardant les
-- ajouts de la 0043 : lecture de site_id depuis la ligne (fallback
-- current_site_id) et lecture de `app.impersonated_by` (GUC pose par la
-- route serveur en mode support).
--
-- A executer dans le SQL Editor APRES 0044.
-- =====================================================================

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb; v_new jsonb; v_ref jsonb;
  v_id  text;
  v_actor uuid;
  v_site  uuid;
  v_imp   uuid;
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
  -- possible sur une table a cle composite ou nommee autrement.
  v_id := coalesce(
    v_ref->>'id',
    v_ref->>'user_id',                                            -- app_user
    nullif(concat_ws(':', v_ref->>'role', v_ref->>'module'), ':') -- role_permission
  );

  -- Auteur : session courante, sinon repli sur les colonnes d'auteur de la
  -- ligne (ecritures service_role, ou auth.uid() vaut NULL).
  v_actor := auth.uid();
  if v_actor is null then
    v_actor := nullif(coalesce(
      v_new->>'created_by', v_new->>'auteur_app_user_id',
      v_old->>'created_by', v_old->>'auteur_app_user_id'
    ), '')::uuid;
  end if;

  -- site_id : lu depuis la ligne (via jsonb, jamais direct), fallback sur
  -- current_site_id() pour les tables qui n'en portent pas encore.
  begin v_site := (v_ref->>'site_id')::uuid; exception when others then v_site := null; end;
  if v_site is null then v_site := public.current_site_id(); end if;

  -- Impersonation : GUC pose par la route serveur au moment d'entrer en
  -- mode support (voir /platform). Absent en usage normal.
  begin v_imp := nullif(current_setting('app.impersonated_by', true), '')::uuid;
  exception when others then v_imp := null;
  end;

  insert into public.audit_log
    (app_user_id, action, table_name, record_id, old_values, new_values, site_id, impersonated_by)
  values (v_actor, tg_op, tg_table_name, v_id, v_old, v_new, v_site, v_imp);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

-- =====================================================================
-- Migration 0031 - Journal d'audit : attribuer l'auteur aux ecritures
-- passees par le service_role (RLS bypassee).
--
-- Le trigger d'audit enregistrait auth.uid(), qui est NULL quand l'ecriture
-- passe par la cle service_role (routes API : matrice, placement, horaire
-- specifique...). Ces entrees apparaissaient donc en « Systeme ».
--
-- On lit desormais, en repli de auth.uid(), les colonnes d'auteur presentes sur
-- la ligne (created_by / auteur_app_user_id) : cela attribue correctement le
-- planning (placement), la matrice et les horaires specifiques. Les tables sans
-- colonne d'auteur (ex. personne) restent en « Systeme ».
--
-- N'affecte que les nouvelles entrees ; l'historique n'est pas recalcule.
-- A executer dans le SQL Editor APRES 0030.
-- =====================================================================

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_id text; v_actor uuid;
begin
  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old); v_new := null; v_id := (old).id::text;
  elsif (tg_op = 'UPDATE') then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_id := (new).id::text;
  else
    v_old := null; v_new := to_jsonb(new); v_id := (new).id::text;
  end if;

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

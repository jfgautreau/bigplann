-- =====================================================================
-- Migration 0048 - current_site_id() lit un header d'impersonation
--
-- CONTEXTE
-- Le super_admin doit pouvoir « entrer » dans un site pour du support,
-- sans qu'un compte technique existe dans le site cible. La strategie
-- retenue en V1a (cf. tasks/multi-site.md §5) :
--
--   1. Depuis /platform, le super_admin clique « Entrer » sur un site.
--   2. La route serveur pose un cookie signe `polaris-impersonate` qui
--      porte le siteId cible + une date d'expiration.
--   3. Le middleware Next (src/proxy.ts) lit ce cookie, valide sa
--      signature, et pose un header custom `x-impersonate-site` sur
--      toutes les requetes qui suivent.
--   4. Supabase JS (via getServerClient) propage ce header vers
--      PostgREST.
--   5. Cote SQL, current_site_id() lit ce header en priorite — MAIS
--      seulement si l'appelant est bien super_admin (defense en
--      profondeur : un header force sur une session normale reste sans
--      effet).
--
-- L'app affiche un bandeau rouge permanent tant que le cookie est
-- present, et la sortie du mode support efface le cookie + trace la
-- fin de session dans audit_impersonation.
--
-- A executer dans le SQL Editor APRES 0047.
-- =====================================================================

create or replace function public.current_site_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_imp_txt text;
  v_imp     uuid;
  v_site    uuid;
begin
  -- 1) Impersonation : header custom pose par la route serveur (via
  --    Supabase JS `global.headers`). PostgREST expose les headers via
  --    current_setting('request.headers'). On tente l'extraction et on
  --    ne blame pas en cas d'absence.
  begin
    v_imp_txt := current_setting('request.headers', true)::json->>'x-impersonate-site';
  exception when others then
    v_imp_txt := null;
  end;

  if v_imp_txt is not null and v_imp_txt <> '' then
    begin
      v_imp := v_imp_txt::uuid;
    exception when others then
      v_imp := null;
    end;

    -- Defense en profondeur : n'honore le header QUE si l'appelant est
    -- super_admin. Un header force par un client malveillant sur une
    -- session normale est ignore silencieusement.
    if v_imp is not null and exists (
      select 1 from public.app_user
      where user_id = auth.uid() and est_super_admin = true and is_active = true
    ) then
      return v_imp;
    end if;
  end if;

  -- 2) Cas normal : site de rattachement de l'utilisateur courant.
  select site_id into v_site
  from public.app_user
  where user_id = auth.uid() and is_active = true;

  return v_site;
end;
$$;

-- Note : audit_trigger (0045) lit deja current_site_id() en fallback,
-- il beneficiera donc automatiquement de l'impersonation. Aucune autre
-- fonction SQL a modifier ici.

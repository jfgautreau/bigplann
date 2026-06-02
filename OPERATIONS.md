# Exploitation — BigPlann'

## Mises à jour de l'application
- Modifier le code, vérifier : `npm run build` puis `npm test`.
- Pousser sur GitHub → Vercel redéploie automatiquement (preview sur branche,
  production sur `main`).

## Migrations de base de données
- Ajouter un fichier `supabase/migrations/00XX_*.sql` (idempotent : `if not exists`,
  `create or replace`, `drop policy if exists`...).
- L'exécuter dans le **SQL Editor** Supabase (ou `npm run db:migrate`).
- Après un DDL, le cache de schéma PostgREST peut mettre ~1 min à se rafraîchir
  (*Project Settings > API > Reload schema* pour forcer).

## Sauvegardes
- Supabase réalise des **sauvegardes automatiques** (selon le plan). Vérifier la
  rétention dans *Database > Backups*.
- Export manuel : *Database > Backups* (ou `pg_dump` via la chaîne de connexion).

## Gestion des utilisateurs
- `/admin/users` : créer un compte (email + mot de passe + rôle). Pas d'email requis.
- Rôles : `admin`, `chef_equipe`, `ordo`, `rh`, `codir`, `planning`.
- Désigner les chefs d'équipe dans `/admin/equipes` (pilote le périmètre d'édition
  de la matrice / du planning / des habilitations).
- Réinitialiser un mot de passe : Supabase *Authentication > Users*, ou via `/forgot`.

## RGPD
- Fiche personne (`/personnel/[id]`) : **Exporter** (JSON), **Anonymiser**, **Supprimer**.
- Registre des traitements : `/admin/rgpd`.

## Journal d'audit
- `/journal` (admin + codir) : toutes les modifications métier tracées.
- Conservation cible 3 ans (purge automatique à mettre en place via tâche planifiée).

## Affichage couloir
- `/affichage` (admin) liste les ateliers ; `/affichage/atelier/{id}` = écran TV
  (J et J+1, refresh 60 s, bouton Imprimer/PDF).
- Restreindre l'accès réseau en production (cf. INSTALL.md §7).

## Dépannage
- « Could not find the table ... in the schema cache » : cache PostgREST pas à jour
  après une migration → attendre ~1 min ou recharger le schéma.
- Page qui redirige vers /login : session expirée (8 h) → se reconnecter.

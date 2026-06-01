# Leçons

## L1 — Valider la stack/hébergement AVANT de coder
Le cahier des charges imposait une stack (Docker/Postgres/Prisma, serveur local),
mais l'utilisateur a finalement choisi Supabase + Vercel. Beaucoup de code a été
écrit puis jeté.
**Règle** : en Lot 0, confirmer explicitement stack ET hébergement avant tout
scaffolding. Une exigence "imposée" dans un cahier peut être renégociée par le client.

## L2 — PowerShell 5.1 : pas de guillemets " dans un message git inline
Un `git commit -m @'...'@` contenant des guillemets doubles a cassé le passage
d'arguments (mots interprétés comme pathspecs).
**Règle** : pour les messages de commit multi-lignes ou avec des `"`, écrire le
message dans un fichier et utiliser `git commit -F fichier` (puis supprimer le fichier).

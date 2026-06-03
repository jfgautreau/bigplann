-- =====================================================================
-- Migration 0014 - Phase 2 : quart sur le placement
-- A executer dans le SQL Editor APRES 0013.
-- =====================================================================

alter table public.placement
  add column if not exists quart_code text references public.quart (code);

create index if not exists placement_quart_idx on public.placement (jour, quart_code);

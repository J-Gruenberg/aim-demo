-- Gedächtnis der KI: gleiche Unterlage, gleiche Lesung, gleicher Preis.
-- Schlüssel = Art + Prompt-Version + Fingerabdruck des Inhalts (Text der Seite oder Datei-Hash).
create table if not exists public.ki_gedaechtnis (
  schluessel text primary key,
  art text not null,
  daten jsonb not null,
  seiten integer,
  modell text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ki_gedaechtnis enable row level security;
create policy ki_gedaechtnis_lesen on public.ki_gedaechtnis for select to authenticated using (public.ist_mitglied());
create policy ki_gedaechtnis_anlegen on public.ki_gedaechtnis for insert to authenticated with check (public.darf_schreiben());
create policy ki_gedaechtnis_aendern on public.ki_gedaechtnis for update to authenticated using (public.darf_schreiben()) with check (public.darf_schreiben());

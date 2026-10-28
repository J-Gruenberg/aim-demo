create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.archiv_positionen (
  id uuid primary key default gen_random_uuid(),
  quelle text not null default 'archiv',
  projekt text not null,
  datum date,
  pos text,
  text text not null,
  kategorie text,
  oberflaeche text,
  montage boolean,
  menge numeric,
  einheit text,
  ep numeric,
  gp numeric,
  kg_je_einheit numeric,
  kalkulation text,
  projekt_id uuid references public.projekte(id) on delete set null,
  position_id uuid references public.positionen(id) on delete set null,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now()
);
alter table public.archiv_positionen add constraint archiv_positionen_position_key unique (position_id);
create index if not exists archiv_positionen_trgm on public.archiv_positionen using gin (text extensions.gin_trgm_ops);
alter table public.archiv_positionen enable row level security;
create policy archiv_lesen on public.archiv_positionen for select to authenticated using (public.ist_mitglied());
create policy archiv_anlegen on public.archiv_positionen for insert to authenticated with check (public.darf_schreiben());
create policy archiv_aendern on public.archiv_positionen for update to authenticated using (public.darf_schreiben()) with check (public.darf_schreiben());
create policy archiv_loeschen on public.archiv_positionen for delete to authenticated using (public.darf_schreiben());

create or replace function public.aehnliche_positionen(suchtext text, such_embedding extensions.vector(1024) default null, anzahl int default 5, ohne_projekt uuid default null)
returns table (id uuid, quelle text, projekt text, datum date, text text, kategorie text, menge numeric, einheit text, ep numeric, kg_je_einheit numeric, oberflaeche text, aehnlichkeit real)
language sql stable security invoker set search_path = public, extensions as $$
  select a.id, a.quelle, a.projekt, a.datum, a.text, a.kategorie, a.menge, a.einheit, a.ep, a.kg_je_einheit, a.oberflaeche,
    case when such_embedding is not null and a.embedding is not null then (1 - (a.embedding <=> such_embedding))::real
         else extensions.similarity(a.text, suchtext) end as aehnlichkeit
  from public.archiv_positionen a
  where a.ep is not null and (ohne_projekt is null or a.projekt_id is distinct from ohne_projekt)
  order by aehnlichkeit desc
  limit anzahl;
$$;

create table if not exists public.stammdaten_vorschlaege (
  id uuid primary key default gen_random_uuid(),
  schluessel text not null,
  alt numeric,
  neu numeric,
  begruendung text not null,
  faelle int,
  status text not null default 'offen',
  created_at timestamptz not null default now(),
  erledigt_at timestamptz
);
alter table public.stammdaten_vorschlaege enable row level security;
create policy vorschlaege_lesen on public.stammdaten_vorschlaege for select to authenticated using (public.ist_mitglied());
create policy vorschlaege_anlegen on public.stammdaten_vorschlaege for insert to authenticated with check (public.darf_schreiben());
create policy vorschlaege_aendern on public.stammdaten_vorschlaege for update to authenticated using (public.darf_schreiben()) with check (public.darf_schreiben());
create policy vorschlaege_loeschen on public.stammdaten_vorschlaege for delete to authenticated using (public.darf_schreiben());

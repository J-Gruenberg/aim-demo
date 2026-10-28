-- AIM Beispielbetrieb: eigene Datenbank, ein Betrieb, Zugang nur auf Einladung.
-- Gleiches Fundament wie jede AIM-Instanz (Baukasten), dazu Betriebsdaten und Zeichnungs-Modul.

create table public.zugelassen (
  email text primary key check (email = lower(email)),
  name text,
  rolle text not null default 'kalkulator' check (rolle in ('admin','kalkulator','leser')),
  created_at timestamptz not null default now()
);

create table public.profile (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  rolle text not null default 'kalkulator' check (rolle in ('admin','kalkulator','leser')),
  created_at timestamptz not null default now()
);

create or replace function public.nur_eingeladene()
returns trigger language plpgsql security definer set search_path = public as $$
declare z record;
begin
  select * into z from public.zugelassen where email = lower(new.email);
  if not found then
    raise exception 'Registrierung nicht erlaubt';
  end if;
  return new;
end $$;

create trigger nur_eingeladene before insert on auth.users
  for each row execute function public.nur_eingeladene();

create or replace function public.profil_anlegen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (id, email, name, rolle)
  select new.id, lower(new.email), z.name, z.rolle from public.zugelassen z where z.email = lower(new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger profil_anlegen after insert on auth.users
  for each row execute function public.profil_anlegen();

create or replace function public.ist_mitglied()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profile where id = auth.uid());
$$;

create or replace function public.darf_schreiben()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profile where id = auth.uid() and rolle in ('admin','kalkulator'));
$$;

create or replace function public.ist_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profile where id = auth.uid() and rolle = 'admin');
$$;

create table public.betrieb (
  id int primary key default 1 check (id = 1),
  daten jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.stammdaten (
  schluessel text primary key,
  gruppe text not null,
  bezeichnung text not null,
  wert numeric,
  einheit text,
  quelle text,
  bestaetigt boolean not null default false,
  notiz text,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profile(id)
);

create table public.projekte (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('halle','lv','bauteil','zeichnung')),
  titel text not null,
  kunde text,
  ort text,
  status text not null default 'entwurf' check (status in ('entwurf','in_pruefung','freigegeben','abgegeben')),
  ergebnis_label text check (ergebnis_label in ('offen','beauftragt','nicht_beauftragt')) default 'offen',
  abgabe date,
  eingaben jsonb not null default '{}'::jsonb,
  ergebnis jsonb not null default '{}'::jsonb,
  angebot jsonb not null default '{}'::jsonb,
  summe_netto numeric,
  ki_budget_eur numeric not null default 25,
  created_by uuid references public.profile(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dateien (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekte(id) on delete cascade,
  pfad text not null unique,
  name text not null,
  groesse bigint,
  art text not null default 'sonstiges' check (art in ('lv','gaeb','plan','baubeschreibung','zeichnung','sonstiges')),
  seiten int,
  gelesen_bis integer,
  text_auszug text,
  created_at timestamptz not null default now()
);

create table public.positionen (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references public.projekte(id) on delete cascade,
  sort int not null default 0,
  oz text,
  kurztext text,
  langtext text,
  menge numeric,
  einheit text,
  typ text,
  ansatz jsonb not null default '{}'::jsonb,
  ep numeric,
  gp numeric,
  sicherheit numeric,
  status text not null default 'offen' check (status in ('offen','berechnet','pruefen','freigegeben')),
  begruendung text,
  quelle text,
  updated_at timestamptz not null default now()
);
create index on public.positionen (projekt_id, sort);

create table public.aenderungen (
  id bigint generated always as identity primary key,
  projekt_id uuid references public.projekte(id) on delete cascade,
  position_id uuid references public.positionen(id) on delete cascade,
  feld text not null,
  alt text,
  neu text,
  grund text,
  user_id uuid references public.profile(id),
  created_at timestamptz not null default now()
);

create table public.ki_aufrufe (
  id bigint generated always as identity primary key,
  projekt_id uuid references public.projekte(id) on delete set null,
  zweck text not null,
  modell text,
  input_tokens int,
  output_tokens int,
  kosten_eur numeric,
  ok boolean not null default true,
  fehler text,
  created_at timestamptz not null default now()
);

create table public.referenzen (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('halle','lv','bauteil','zeichnung')),
  name text not null,
  datum date,
  kunde text,
  angebot_nr text,
  angebot_netto numeric,
  daten jsonb not null default '{}'::jsonb,
  quelle text,
  created_at timestamptz not null default now()
);

create or replace function public.touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_projekte before update on public.projekte for each row execute function public.touch();
create trigger t_positionen before update on public.positionen for each row execute function public.touch();
create trigger t_stammdaten before update on public.stammdaten for each row execute function public.touch();
create trigger t_betrieb before update on public.betrieb for each row execute function public.touch();

alter table public.zugelassen enable row level security;
alter table public.profile enable row level security;
alter table public.betrieb enable row level security;
alter table public.stammdaten enable row level security;
alter table public.projekte enable row level security;
alter table public.dateien enable row level security;
alter table public.positionen enable row level security;
alter table public.aenderungen enable row level security;
alter table public.ki_aufrufe enable row level security;
alter table public.referenzen enable row level security;

create policy profile_lesen on public.profile for select to authenticated using (public.ist_mitglied());
create policy betrieb_lesen on public.betrieb for select to authenticated using (public.ist_mitglied());
create policy betrieb_aendern on public.betrieb for update to authenticated using (public.ist_admin()) with check (public.ist_admin());

do $$
declare t text;
begin
  foreach t in array array['stammdaten','projekte','dateien','positionen','aenderungen','ki_aufrufe','referenzen'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.ist_mitglied())', t||'_lesen', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.darf_schreiben())', t||'_anlegen', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.darf_schreiben()) with check (public.darf_schreiben())', t||'_aendern', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.darf_schreiben())', t||'_loeschen', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('unterlagen', 'unterlagen', false, 104857600)
on conflict (id) do nothing;

create policy unterlagen_lesen on storage.objects for select to authenticated
  using (bucket_id = 'unterlagen' and public.ist_mitglied());
create policy unterlagen_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'unterlagen' and public.darf_schreiben());
create policy unterlagen_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'unterlagen' and public.darf_schreiben());

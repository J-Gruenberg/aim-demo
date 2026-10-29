-- Kalkulationen archivieren statt löschen, sobald sie geprüft, freigegeben oder abgegeben waren
alter table public.projekte add column if not exists archiviert_am timestamptz;
create index if not exists projekte_archiviert_am on public.projekte (archiviert_am);

-- Einen Schlüssel in projekte.ergebnis setzen, ohne parallele Schreiber zu überschreiben
-- (Prüfung, Abgleich und Benennung laufen gleichzeitig). Läuft mit den Rechten des Aufrufers, RLS greift.
create or replace function public.ergebnis_setzen(p_id uuid, p_schluessel text, p_wert jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.projekte
     set ergebnis = coalesce(ergebnis, '{}'::jsonb) || jsonb_build_object(p_schluessel, p_wert),
         updated_at = now()
   where id = p_id;
$$;
revoke all on function public.ergebnis_setzen(uuid, text, jsonb) from public, anon;
grant execute on function public.ergebnis_setzen(uuid, text, jsonb) to authenticated;

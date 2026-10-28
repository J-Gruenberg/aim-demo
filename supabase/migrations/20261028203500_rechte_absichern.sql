-- Hilfsfunktionen nur für angemeldete Nutzer (RLS), Trigger-Funktionen gar nicht über die API aufrufbar.
revoke execute on function public.ist_mitglied(), public.ist_admin(), public.darf_schreiben() from public, anon;
grant execute on function public.ist_mitglied(), public.ist_admin(), public.darf_schreiben() to authenticated;
revoke execute on function public.nur_eingeladene(), public.profil_anlegen() from public, anon, authenticated;

-- permission_matrix en businesses: forzar tasks_view_all = false para nivel propietario.
-- No altera otros niveles (p. ej. alto sigue pudiendo tener tasks_view_all en true).

UPDATE public.businesses
SET permission_matrix = jsonb_set(
  COALESCE(permission_matrix, '{}'::jsonb),
  '{propietario,tasks_view_all}',
  'false'::jsonb,
  true
);

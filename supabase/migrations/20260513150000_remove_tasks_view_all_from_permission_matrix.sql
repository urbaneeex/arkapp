-- Elimina la clave tasks_view_all de cada nivel en businesses.permission_matrix (jsonb).

UPDATE public.businesses AS b
SET permission_matrix = (
  SELECT coalesce(
    jsonb_object_agg(
      lvl_key,
      CASE
        WHEN jsonb_typeof(lvl_val) = 'object' THEN lvl_val - 'tasks_view_all'
        ELSE lvl_val
      END
    ),
    '{}'::jsonb
  )
  FROM jsonb_each(coalesce(b.permission_matrix, '{}'::jsonb)) AS t(lvl_key, lvl_val)
);

-- Reparación idempotente: reaplica la definición correcta de SELECT RLS por cita.
-- Útil si la base tenía aún el bypass por owner_uid (migración 20260429320000 antigua)
-- o si alguien sobrescribió la función manualmente. Mismo cuerpo que 20260513130000.

CREATE OR REPLACE FUNCTION private.user_can_select_appointment_row(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_id
      AND private.user_can_access_business(a.business_id)
      AND (
        a.created_by IS NOT DISTINCT FROM auth.uid()
        OR a.staff_id IS NOT DISTINCT FROM auth.uid()
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)) = 'array'
              THEN COALESCE(a.metadata->'kanban_assignees', '[]'::jsonb)
              ELSE '[]'::jsonb
            END
          ) elem
          WHERE (elem->>'id') IS NOT DISTINCT FROM auth.uid()::text
        )
        OR (
          a.visibility = 'team'
          AND private.appointment_user_is_team_member(p_id)
        )
        OR (a.visibility = 'business')
      )
  );
$$;

COMMENT ON FUNCTION private.user_can_select_appointment_row(uuid) IS
  'RLS lectura: creador, asignados, kanban_assignees, team+miembro, o visibility=business para cualquier usuario con acceso al negocio.';

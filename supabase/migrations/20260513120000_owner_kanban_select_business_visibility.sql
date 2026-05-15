-- SELECT appointments: el propietario ya no ve todas las filas del negocio en Kanban.
-- Ve las mismas reglas que el staff (creador, asignación, team) + visibility = 'business'.

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
        OR (
          a.visibility = 'business'
          AND EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = a.business_id
              AND b.owner_uid IS NOT DISTINCT FROM auth.uid()
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION private.user_can_select_appointment_row(uuid) IS
  'RLS lectura: creador/asignados/equipo; propietario además ve visibility=business (no el kanban completo del negocio).';

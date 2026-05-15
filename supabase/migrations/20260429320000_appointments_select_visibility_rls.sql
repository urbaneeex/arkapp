-- SELECT appointments: visibilidad estricta por columna `visibility`.
-- - Propietario del negocio (businesses.owner_uid): ve todas las filas del negocio.
-- - Staff (no propietario): solo creador, asignación explícita (staff_id / kanban_assignees),
--   y si visibility = 'team' además miembros de equipos vinculados (team_id / appointment_teams).
-- - Quitado bypass por user_is_owner_or_high_staff: admin/alto ya no ven tareas ajenas sin asignación/equipo.
-- - visibility = 'business': creador + asignados + propietario (no visión global para todo el staff).

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
        EXISTS (
          SELECT 1
          FROM public.businesses b
          WHERE b.id = a.business_id
            AND b.owner_uid IS NOT DISTINCT FROM auth.uid()
        )
        OR a.created_by IS NOT DISTINCT FROM auth.uid()
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
      )
  );
$$;

COMMENT ON FUNCTION private.user_can_select_appointment_row(uuid) IS
  'RLS lectura citas: propietario ve todo; resto ve creador/asignados; visibility=team añade miembros de equipos de la tarea.';

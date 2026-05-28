-- Acceso a citas/tareas: solo participantes (creador o asignados).
-- visibility/team_id no conceden lectura ni edición; propietario = mismo criterio en Kanban.

CREATE OR REPLACE FUNCTION private.appointment_user_is_participant(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
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
      )
  );
$$;

REVOKE ALL ON FUNCTION private.appointment_user_is_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.appointment_user_is_participant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.appointment_user_is_participant(uuid) TO authenticated;

COMMENT ON FUNCTION private.appointment_user_is_participant(uuid) IS
  'Participante de la cita: creador, staff_id principal o kanban_assignees. Sin bypass por equipo/visibilidad.';

CREATE OR REPLACE FUNCTION private.user_can_select_appointment_row(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.appointment_user_is_participant(p_id);
$$;

COMMENT ON FUNCTION private.user_can_select_appointment_row(uuid) IS
  'RLS lectura: solo participantes (creador o asignados). visibility/team no amplían acceso.';

CREATE OR REPLACE FUNCTION private.appointment_user_can_update_delete(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.appointment_user_is_participant(p_appointment_id);
$$;

COMMENT ON FUNCTION private.appointment_user_can_update_delete(uuid) IS
  'UPDATE puente appointment_teams y mutaciones relacionadas: solo participantes.';

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND private.appointment_user_is_participant(id)
  )
  WITH CHECK (
    private.user_can_access_business(business_id)
    AND private.appointment_user_is_participant(id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
  );

COMMENT ON COLUMN public.appointments.visibility IS
  'Clasificación interna (personal/team/business). No controla acceso RLS; solo participantes ven/editan la tarea.';

-- UPDATE appointments: solo quien creó la fila (created_by), sin bypass CEO/asignado/equipo/líder.
-- appointment_teams y mutaciones que usan appointment_user_can_update_delete quedan alineadas.

CREATE OR REPLACE FUNCTION private.appointment_user_can_update_delete(p_appointment_id uuid)
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
      AND a.created_by IS NOT DISTINCT FROM auth.uid()
  );
$$;

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND created_by IS NOT DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    private.user_can_access_business(business_id)
    AND created_by IS NOT DISTINCT FROM auth.uid()
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
  );

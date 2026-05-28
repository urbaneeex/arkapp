-- DELETE appointments: solo creador. Sin bypass propietario/alto ni permiso appointments_delete en RLS.

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    private.user_can_access_business(business_id)
    AND created_by IS NOT DISTINCT FROM auth.uid()
  );

COMMENT ON POLICY appointments_delete ON public.appointments IS
  'Solo el creador de la tarea puede eliminarla; asignados editan pero no borran.';

-- appointment_user_can_update_delete sigue siendo participante (puente appointment_teams), no DELETE de fila.

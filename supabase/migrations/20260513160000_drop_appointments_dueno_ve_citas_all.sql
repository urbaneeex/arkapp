-- Política manual "Dueño ve citas" (cmd ALL) en muchos proyectos permite al owner
-- SELECT/UPDATE/DELETE/INSERT según USING; para SELECT es OR con appointments_select
-- y anula la función private.user_can_select_appointment_row (owner ve todas las citas).
DROP POLICY IF EXISTS "Dueño ve citas" ON public.appointments;

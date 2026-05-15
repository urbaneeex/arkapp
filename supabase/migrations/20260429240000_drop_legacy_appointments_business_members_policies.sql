-- Quita políticas legacy "Business members can * appointments" que hacían OR con
-- appointments_* y permitían ver todas las citas del negocio a cualquier miembro
-- (check_business_access). Solo deben aplicar las políticas appointments_select/insert/update/delete.

DROP POLICY IF EXISTS "Business members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Business members can delete appointments" ON public.appointments;

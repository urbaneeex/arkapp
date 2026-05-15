-- Acceso al negocio: propietario, staff activo, o miembro de un equipo de ese negocio.
-- Alinea RLS (p. ej. appointments_insert) con usuarios vinculados solo vía team_members.

CREATE OR REPLACE FUNCTION private.user_can_access_business(b_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = b_id AND b.owner_uid = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.business_id = b_id AND s.id = auth.uid() AND s.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_members tm
    INNER JOIN public.teams t ON t.id = tm.team_id AND t.business_id = b_id
    WHERE tm.staff_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION private.user_can_access_business(uuid) IS
  'RLS: propietario, staff activo del negocio, o miembro de algún equipo del negocio.';

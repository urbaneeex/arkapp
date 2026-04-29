-- Equipos + visibilidad en citas/tablero + RLS en appointments, teams, team_members

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff (id) ON DELETE CASCADE,
  is_lead boolean NOT NULL DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (team_id, staff_id)
);

CREATE INDEX IF NOT EXISTS team_members_staff_id_idx ON public.team_members (staff_id);
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON public.team_members (team_id);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'team'
    CHECK (visibility IN ('personal', 'team', 'business'));

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_team_id_idx ON public.appointments (team_id);
CREATE INDEX IF NOT EXISTS appointments_visibility_idx ON public.appointments (visibility);

COMMENT ON COLUMN public.appointments.visibility IS 'personal = solo asignado + admins; team = miembros del equipo + admins; business = todo el negocio';
COMMENT ON COLUMN public.appointments.team_id IS 'Equipo cuando visibility = team';

-- Al borrar equipo: citas pasan a visibilidad negocio (además de SET NULL en FK)
CREATE OR REPLACE FUNCTION public.before_delete_team_reassign_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.appointments
  SET team_id = NULL, visibility = 'business'
  WHERE team_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS tr_teams_before_delete_reassign ON public.teams;
CREATE TRIGGER tr_teams_before_delete_reassign
  BEFORE DELETE ON public.teams
  FOR EACH ROW
  EXECUTE PROCEDURE public.before_delete_team_reassign_appointments();

-- ---------------------------------------------------------------------------
-- Helpers RLS (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_access_business(b_id uuid)
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
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_owner_or_high_staff(b_id uuid)
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
    WHERE s.business_id = b_id
      AND s.id = auth.uid()
      AND s.deleted_at IS NULL
      AND (
        coalesce(s.access_level, 'basico') IN ('alto', 'admin')
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_business(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_is_owner_or_high_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_business(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_owner_or_high_staff(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS teams / team_members
-- ---------------------------------------------------------------------------

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated
  USING (public.user_can_access_business(business_id));

DROP POLICY IF EXISTS teams_insert ON public.teams;
DROP POLICY IF EXISTS teams_update ON public.teams;
DROP POLICY IF EXISTS teams_delete ON public.teams;
CREATE POLICY teams_insert ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (public.user_is_owner_or_high_staff(business_id));

CREATE POLICY teams_update ON public.teams
  FOR UPDATE TO authenticated
  USING (public.user_is_owner_or_high_staff(business_id))
  WITH CHECK (public.user_is_owner_or_high_staff(business_id));

CREATE POLICY teams_delete ON public.teams
  FOR DELETE TO authenticated
  USING (public.user_is_owner_or_high_staff(business_id));

DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_can_access_business(t.business_id)
    )
  );

DROP POLICY IF EXISTS team_members_insert ON public.team_members;
DROP POLICY IF EXISTS team_members_update ON public.team_members;
DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_insert ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_is_owner_or_high_staff(t.business_id)
    )
  );

CREATE POLICY team_members_update ON public.team_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_is_owner_or_high_staff(t.business_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_is_owner_or_high_staff(t.business_id)
    )
  );

CREATE POLICY team_members_delete ON public.team_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id
        AND public.user_is_owner_or_high_staff(t.business_id)
    )
  );

-- ---------------------------------------------------------------------------
-- RLS appointments
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR visibility = 'business'
      OR (
        visibility = 'personal'
        AND staff_id IS NOT DISTINCT FROM auth.uid()
      )
      OR (
        visibility = 'team'
        AND team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = appointments.team_id
            AND tm.staff_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS appointments_insert ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_access_business(business_id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
  );

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR (
        team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = appointments.team_id
            AND tm.staff_id = auth.uid()
            AND tm.is_lead = true
        )
      )
    )
  )
  WITH CHECK (
    public.user_can_access_business(business_id)
    AND (
      team_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = team_id AND t.business_id = appointments.business_id
      )
    )
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR (
        team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.team_id = appointments.team_id
            AND tm.staff_id = auth.uid()
            AND tm.is_lead = true
        )
      )
    )
  );

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (public.user_is_owner_or_high_staff(business_id));

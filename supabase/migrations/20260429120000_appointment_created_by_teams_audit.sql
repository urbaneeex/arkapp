-- Creador de cita, multi-equipo (appointment_teams), auditoría, RLS actualizado

-- ---------------------------------------------------------------------------
-- Columnas y trigger created_by
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_business_created_by_idx
  ON public.appointments (business_id, created_by);

COMMENT ON COLUMN public.appointments.created_by IS 'Usuario auth que creó la fila (Kanban/manual); NULL si reserva pública / sistema.';

CREATE OR REPLACE FUNCTION public.set_appointment_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_appointments_set_created_by ON public.appointments;
CREATE TRIGGER tr_appointments_set_created_by
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_appointment_created_by();

REVOKE ALL ON FUNCTION public.set_appointment_created_by() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_appointment_created_by() TO authenticated;

-- ---------------------------------------------------------------------------
-- Puente N equipos por cita
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.appointment_teams (
  appointment_id uuid NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, team_id)
);

CREATE INDEX IF NOT EXISTS appointment_teams_team_id_idx ON public.appointment_teams (team_id);

COMMENT ON TABLE public.appointment_teams IS 'Equipos vinculados a una cita/tarea (además de appointments.team_id opcional).';

-- Datos existentes: copiar team_id único al puente
INSERT INTO public.appointment_teams (appointment_id, team_id)
SELECT id, team_id FROM public.appointments
WHERE team_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers RLS (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.appointment_user_is_team_lead(p_appointment_id uuid)
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
      AND (
        (
          a.team_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = a.team_id
              AND tm.staff_id = auth.uid()
              AND tm.is_lead = true
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.appointment_teams at
          INNER JOIN public.team_members tm
            ON tm.team_id = at.team_id
            AND tm.staff_id = auth.uid()
            AND tm.is_lead = true
          WHERE at.appointment_id = a.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.appointment_user_can_update_delete(p_appointment_id uuid)
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
      AND public.user_can_access_business(a.business_id)
      AND (
        public.user_is_owner_or_high_staff(a.business_id)
        OR a.created_by IS NOT DISTINCT FROM auth.uid()
        OR a.staff_id IS NOT DISTINCT FROM auth.uid()
        OR public.appointment_user_is_team_lead(a.id)
      )
  );
$$;

-- Lectura tab appointments sin dependencias circulares RLS (definer bypass).
CREATE OR REPLACE FUNCTION public.user_can_select_appointment_row(p_id uuid)
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
      AND public.user_can_access_business(a.business_id)
      AND (
        public.user_is_owner_or_high_staff(a.business_id)
        OR a.created_by IS NOT DISTINCT FROM auth.uid()
        OR a.visibility = 'business'
        OR (
          a.visibility = 'personal'
          AND a.staff_id IS NOT DISTINCT FROM auth.uid()
        )
        OR (
          a.visibility = 'team'
          AND (
            (
              a.team_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.team_members tm
                WHERE tm.team_id = a.team_id
                  AND tm.staff_id = auth.uid()
              )
            )
            OR EXISTS (
              SELECT 1
              FROM public.appointment_teams atx
              INNER JOIN public.team_members tm
                ON tm.team_id = atx.team_id
                  AND tm.staff_id = auth.uid()
              WHERE atx.appointment_id = a.id
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.appointment_user_is_team_lead(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.appointment_user_can_update_delete(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_select_appointment_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.appointment_user_is_team_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_user_can_update_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_select_appointment_row(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Tabla auditoría
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.appointment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_audit_log_business_created_idx
  ON public.appointment_audit_log (business_id, created_at DESC);

COMMENT ON TABLE public.appointment_audit_log IS 'Historial de cambios en appointments (triggers); lectura CEO/admin alto.';

CREATE OR REPLACE FUNCTION public.appointments_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, new_record)
    VALUES (NEW.id, NEW.business_id, auth.uid(), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, old_record, new_record)
    VALUES (NEW.id, NEW.business_id, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, old_record)
    VALUES (OLD.id, OLD.business_id, auth.uid(), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_appointments_audit_insert ON public.appointments;
DROP TRIGGER IF EXISTS tr_appointments_audit_update ON public.appointments;
DROP TRIGGER IF EXISTS tr_appointments_audit_delete ON public.appointments;

CREATE TRIGGER tr_appointments_audit_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.appointments_write_audit();

CREATE TRIGGER tr_appointments_audit_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.appointments_write_audit();

CREATE TRIGGER tr_appointments_audit_delete
  AFTER DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.appointments_write_audit();

REVOKE ALL ON FUNCTION public.appointments_write_audit() FROM PUBLIC;

ALTER TABLE public.appointment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_audit_log_select ON public.appointment_audit_log;
CREATE POLICY appointment_audit_log_select ON public.appointment_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = appointment_audit_log.business_id
        AND b.owner_uid = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.business_id = appointment_audit_log.business_id
        AND s.id = auth.uid()
        AND s.deleted_at IS NULL
        AND coalesce(s.access_level, 'basico') IN ('alto', 'admin')
    )
  );

-- Sin políticas INSERT/UPDATE/DELETE para authenticated: solo triggers (SECURITY DEFINER → propietario tabla).

-- ---------------------------------------------------------------------------
-- RLS appointment_teams
-- ---------------------------------------------------------------------------

ALTER TABLE public.appointment_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_teams_select ON public.appointment_teams;
CREATE POLICY appointment_teams_select ON public.appointment_teams
  FOR SELECT TO authenticated
  USING (public.user_can_select_appointment_row(appointment_id));

DROP POLICY IF EXISTS appointment_teams_insert ON public.appointment_teams;
CREATE POLICY appointment_teams_insert ON public.appointment_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = appointment_teams.team_id
        AND EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = appointment_teams.appointment_id
            AND a.business_id = t.business_id
            AND public.appointment_user_can_update_delete(a.id)
        )
    )
  );

DROP POLICY IF EXISTS appointment_teams_delete ON public.appointment_teams;
CREATE POLICY appointment_teams_delete ON public.appointment_teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_teams.appointment_id
        AND public.appointment_user_can_update_delete(a.id)
    )
  );

-- ---------------------------------------------------------------------------
-- Políticas appointments (reemplazo)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS appointments_select ON public.appointments;
CREATE POLICY appointments_select ON public.appointments
  FOR SELECT TO authenticated
  USING (public.user_can_select_appointment_row(id));

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
    AND (
      created_by IS NULL
      OR created_by = auth.uid()
      OR public.user_is_owner_or_high_staff(business_id)
    )
  );

DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR public.appointment_user_is_team_lead(id)
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
      OR created_by IS NOT DISTINCT FROM auth.uid()
      OR staff_id IS NOT DISTINCT FROM auth.uid()
      OR public.appointment_user_is_team_lead(id)
    )
  );

DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments
  FOR DELETE TO authenticated
  USING (
    public.user_can_access_business(business_id)
    AND (
      public.user_is_owner_or_high_staff(business_id)
      OR created_by IS NOT DISTINCT FROM auth.uid()
      OR public.appointment_user_is_team_lead(id)
    )
  );

GRANT SELECT ON TABLE public.appointment_audit_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.appointment_teams TO authenticated;

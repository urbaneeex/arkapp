-- Comentarios en citas/tareas + lectura de auditoría para quien puede ver la cita.

CREATE TABLE IF NOT EXISTS public.appointment_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_comments_appointment_created_idx
  ON public.appointment_comments (appointment_id, created_at ASC);

COMMENT ON TABLE public.appointment_comments IS 'Comentarios de equipo en citas del tablero (contenido TipTap JSON).';

ALTER TABLE public.appointment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_comments_select ON public.appointment_comments;
CREATE POLICY appointment_comments_select ON public.appointment_comments
  FOR SELECT TO authenticated
  USING (private.user_can_select_appointment_row(appointment_id));

DROP POLICY IF EXISTS appointment_comments_insert ON public.appointment_comments;
CREATE POLICY appointment_comments_insert ON public.appointment_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND private.user_can_select_appointment_row(appointment_id)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_comments.appointment_id
        AND a.business_id = appointment_comments.business_id
    )
  );

DROP POLICY IF EXISTS appointment_comments_delete ON public.appointment_comments;
CREATE POLICY appointment_comments_delete ON public.appointment_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    AND private.user_can_select_appointment_row(appointment_id)
  );

GRANT SELECT, INSERT, DELETE ON TABLE public.appointment_comments TO authenticated;

-- Auditoría: quien ve la cita puede leer el historial de esa cita.
DROP POLICY IF EXISTS appointment_audit_log_select ON public.appointment_audit_log;
CREATE POLICY appointment_audit_log_select ON public.appointment_audit_log
  FOR SELECT TO authenticated
  USING (private.user_can_select_appointment_row(appointment_id));

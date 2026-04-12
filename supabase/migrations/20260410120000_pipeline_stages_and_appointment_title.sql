-- Embudo por negocio + título en citas (work items).
-- Orden columnas Kanban: pendiente → confirmada → en curso → completada → cancelada → no presentado

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT pipeline_stages_business_slug_unique UNIQUE (business_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_business_sort
  ON public.pipeline_stages (business_id, sort_order);

COMMENT ON TABLE public.pipeline_stages IS 'Etapas del embudo por negocio; slug alineado con appointment_status para migración sin pérdida.';

INSERT INTO public.pipeline_stages (business_id, slug, label, sort_order)
SELECT b.id, x.slug, x.label, x.ord
FROM public.businesses b
CROSS JOIN (
  VALUES
    ('pending', 'Pendiente', 1),
    ('confirmed', 'Confirmada', 2),
    ('in_progress', 'En curso', 3),
    ('completed', 'Completada', 4),
    ('cancelled', 'Cancelada', 5),
    ('no_show', 'No se presentó', 6)
) AS x(slug, label, ord)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.pipeline_stages ps
  WHERE ps.business_id = b.id AND ps.slug = x.slug
);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pipeline_stage_id uuid REFERENCES public.pipeline_stages (id);

UPDATE public.appointments a
SET pipeline_stage_id = ps.id
FROM public.pipeline_stages ps
WHERE ps.business_id = a.business_id
  AND ps.slug = COALESCE(a.status::text, 'pending')
  AND a.pipeline_stage_id IS NULL;

UPDATE public.appointments a
SET title = COALESCE(
  NULLIF(trim(coalesce(a.title, '')), ''),
  (SELECT s.name FROM public.services s WHERE s.id = a.service_id),
  (SELECT c.name FROM public.clients c WHERE c.id = a.client_id),
  'Cita'
);

ALTER TABLE public.appointments
  ALTER COLUMN pipeline_stage_id SET NOT NULL;

-- Una sola función: si falta etapa, deducirla del status; siempre alinear status desde slug de etapa
CREATE OR REPLACE FUNCTION public.appointments_sync_stage_and_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  stage_slug text;
BEGIN
  IF NEW.pipeline_stage_id IS NULL AND NEW.business_id IS NOT NULL THEN
    SELECT id INTO NEW.pipeline_stage_id
    FROM public.pipeline_stages
    WHERE business_id = NEW.business_id
      AND slug = COALESCE(NEW.status::text, 'pending')
    LIMIT 1;
  END IF;

  IF NEW.pipeline_stage_id IS NOT NULL THEN
    SELECT slug INTO stage_slug
    FROM public.pipeline_stages
    WHERE id = NEW.pipeline_stage_id;

    IF stage_slug IS NOT NULL THEN
      NEW.status := stage_slug::public.appointment_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_sync_stage_and_status ON public.appointments;
CREATE TRIGGER trg_appointments_sync_stage_and_status
  BEFORE INSERT OR UPDATE OF pipeline_stage_id, status ON public.appointments
  FOR EACH ROW
  EXECUTE PROCEDURE public.appointments_sync_stage_and_status();

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_stages_select_member ON public.pipeline_stages;

CREATE POLICY pipeline_stages_select_member
  ON public.pipeline_stages
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_uid = (SELECT auth.uid()))
    OR business_id IN (
      SELECT business_id FROM public.staff
      WHERE id = (SELECT auth.uid()) AND deleted_at IS NULL
    )
  );

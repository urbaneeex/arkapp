-- Categorías fijas del tablero + color. Ejecutar en Supabase SQL Editor o con `supabase db push`.
-- Las filas faltantes por negocio se crean al cargar el tablero (`ensurePipelineStagesForBusiness`).

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS color text;

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS stage_category text;

UPDATE public.pipeline_stages
SET color = '#6366f1'
WHERE color IS NULL OR btrim(color) = '';

UPDATE public.pipeline_stages
SET stage_category = CASE slug
  WHEN 'pending' THEN 'not_started'
  WHEN 'confirmed' THEN 'active'
  WHEN 'in_progress' THEN 'active'
  WHEN 'completed' THEN 'done'
  WHEN 'cancelled' THEN 'closed'
  WHEN 'no_show' THEN 'closed'
  ELSE 'active'
END
WHERE stage_category IS NULL OR btrim(stage_category) = '';

ALTER TABLE public.pipeline_stages
  ALTER COLUMN stage_category SET DEFAULT 'active';

ALTER TABLE public.pipeline_stages
  ALTER COLUMN stage_category SET NOT NULL;

ALTER TABLE public.pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_stage_category_check;

ALTER TABLE public.pipeline_stages
  ADD CONSTRAINT pipeline_stages_stage_category_check
  CHECK (stage_category = ANY (ARRAY['not_started','active','done','closed']::text[]));

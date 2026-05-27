-- Índice adicional para queries hero "hoy" en dashboard.

CREATE INDEX IF NOT EXISTS appointments_business_today_idx
  ON public.appointments (business_id, start_time)
  WHERE archived_at IS NULL;

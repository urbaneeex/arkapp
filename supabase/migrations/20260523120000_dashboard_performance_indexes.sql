-- Índices para queries del dashboard (Inicio): métricas, completadas, fichajes.

CREATE INDEX IF NOT EXISTS appointments_dashboard_metrics_idx
  ON public.appointments (business_id, archived_at, start_time)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS appointments_completed_at_idx
  ON public.appointments (business_id, completed_at)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS time_entries_business_clock_in_idx
  ON public.time_entries (business_id, clock_in);

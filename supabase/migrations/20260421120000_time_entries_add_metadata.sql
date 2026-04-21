-- Auditoría anti-suplantación GPS: almacena IP del cliente en cada fichaje.
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

-- Evolution API (WhatsApp) integration: columns on public.businesses
-- Run with: supabase db push (or execute in SQL Editor)

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS wa_instance_name text,
  ADD COLUMN IF NOT EXISTS wa_status text NOT NULL DEFAULT 'disconnected';

COMMENT ON COLUMN public.businesses.wa_instance_name IS 'Nombre de la instancia en Evolution API';
COMMENT ON COLUMN public.businesses.wa_status IS 'Estado WhatsApp: disconnected | pending_qr | connected';

-- Optional: constraint to restrict wa_status values (uncomment if desired)
-- ALTER TABLE public.businesses
--   ADD CONSTRAINT businesses_wa_status_check
--   CHECK (wa_status IN ('disconnected', 'pending_qr', 'connected'));

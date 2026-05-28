-- Actividad: purgar historial genérico y refinar trigger (sin «Sistema», sin ruido board_sort_order).

TRUNCATE public.appointment_audit_log;

CREATE OR REPLACE FUNCTION public.appointments_write_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
BEGIN
  actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, new_record)
    VALUES (NEW.id, NEW.business_id, COALESCE(actor, NEW.created_by), 'insert', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF actor IS NULL THEN
      RETURN NEW;
    END IF;

    IF (
      OLD.title IS NOT DISTINCT FROM NEW.title
      AND OLD.start_time IS NOT DISTINCT FROM NEW.start_time
      AND OLD.end_time IS NOT DISTINCT FROM NEW.end_time
      AND OLD.staff_id IS NOT DISTINCT FROM NEW.staff_id
      AND OLD.client_id IS NOT DISTINCT FROM NEW.client_id
      AND OLD.service_id IS NOT DISTINCT FROM NEW.service_id
      AND OLD.pipeline_stage_id IS NOT DISTINCT FROM NEW.pipeline_stage_id
      AND OLD.team_id IS NOT DISTINCT FROM NEW.team_id
      AND OLD.visibility IS NOT DISTINCT FROM NEW.visibility
      AND OLD.metadata IS NOT DISTINCT FROM NEW.metadata
      AND OLD.status IS NOT DISTINCT FROM NEW.status
      AND OLD.completed_at IS NOT DISTINCT FROM NEW.completed_at
      AND OLD.archived_at IS NOT DISTINCT FROM NEW.archived_at
      AND OLD.price_total IS NOT DISTINCT FROM NEW.price_total
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, old_record, new_record)
    VALUES (NEW.id, NEW.business_id, actor, 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF actor IS NULL THEN
      RETURN OLD;
    END IF;
    INSERT INTO public.appointment_audit_log (appointment_id, business_id, actor_id, action, old_record)
    VALUES (OLD.id, OLD.business_id, actor, 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.appointments_write_audit() IS
  'Auditoría appointments: insert con actor; update/delete solo con auth.uid(); omite solo board_sort_order y service role.';

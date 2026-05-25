-- ============================================================
-- ChangPro v6 — Job reassignment + notification on assigned_to change
-- ============================================================

-- ─── Update job notification trigger to handle reassignment ──
CREATE OR REPLACE FUNCTION notify_job_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tech_profile_id      UUID;
  v_old_tech_profile_id  UUID;
  v_admin_id             UUID;
  v_tech_name            TEXT;
  v_old_tech_name        TEXT;
  v_kind                 TEXT;
  v_title                TEXT;
  v_body                 TEXT;
BEGIN
  -- INSERT: job created with assignment
  IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
    SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
    IF v_tech_profile_id IS NOT NULL THEN
      INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
      VALUES (
        NEW.org_id, v_tech_profile_id, 'job_assigned',
        '🔧 คุณได้รับมอบหมายงานใหม่',
        NEW.title || COALESCE(' · ' || NEW.location, ''),
        jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code, 'priority', NEW.priority)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN

    -- ── Reassignment (assigned_to changed) ──
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
      -- Notify NEW assignee
      IF NEW.assigned_to IS NOT NULL THEN
        SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
        IF v_tech_profile_id IS NOT NULL THEN
          INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
          VALUES (
            NEW.org_id, v_tech_profile_id, 'job_assigned',
            '🔧 คุณได้รับมอบหมายงาน',
            NEW.title || COALESCE(' · ' || NEW.location, ''),
            jsonb_build_object(
              'job_id', NEW.id, 'job_code', NEW.job_code,
              'priority', NEW.priority, 'reassigned', true
            )
          );
        END IF;
      END IF;

      -- Notify OLD assignee (if existed) about being unassigned
      IF OLD.assigned_to IS NOT NULL THEN
        SELECT id INTO v_old_tech_profile_id FROM profiles WHERE employee_id = OLD.assigned_to;
        SELECT full_name INTO v_old_tech_name FROM employees WHERE id = OLD.assigned_to;
        IF v_old_tech_profile_id IS NOT NULL THEN
          INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
          VALUES (
            NEW.org_id, v_old_tech_profile_id, 'job_unassigned',
            'งานถูกย้ายไปช่างคนอื่น',
            'งาน "' || NEW.title || '" ไม่ใช่ของคุณแล้ว',
            jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code)
          );
        END IF;
      END IF;

      -- Skip status notification for this update if it was just reassignment
      IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    END IF;

    -- ── Status transitions ──
    IF NEW.status != OLD.status THEN
      SELECT full_name INTO v_tech_name FROM employees WHERE id = NEW.assigned_to;

      -- Tech submitted for inspection → notify admins
      IF NEW.status = 'awaiting_inspection' THEN
        FOR v_admin_id IN
          SELECT id FROM profiles WHERE org_id = NEW.org_id AND role IN ('admin','manager')
        LOOP
          INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
          VALUES (NEW.org_id, v_admin_id, 'job_submitted',
            '🔔 งานรอตรวจ',
            COALESCE(v_tech_name, 'ช่าง') || ' ส่งงาน "' || NEW.title || '" รอตรวจ',
            jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code,
              'employee_id', NEW.assigned_to, 'employee_name', v_tech_name));
        END LOOP;

      -- Approved
      ELSIF NEW.status = 'approved' THEN
        SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
        IF v_tech_profile_id IS NOT NULL THEN
          INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
          VALUES (NEW.org_id, v_tech_profile_id, 'job_approved',
            '✅ งานผ่านการตรวจ',
            'งาน "' || NEW.title || '" ผ่านการตรวจเรียบร้อย',
            jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code));
        END IF;

      -- Rejected
      ELSIF NEW.status = 'rejected' THEN
        SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
        IF v_tech_profile_id IS NOT NULL THEN
          INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
          VALUES (NEW.org_id, v_tech_profile_id, 'job_rejected',
            '⚠️ งานไม่ผ่านการตรวจ',
            'งาน "' || NEW.title || '" — ' || COALESCE(NEW.inspection_note, 'กรุณาแก้ไข'),
            jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code,
              'inspection_note', NEW.inspection_note));
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Add new notification kind ──────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'clock_in','clock_out','geofence_exit','geofence_return','long_idle',
  'payroll_approved','payroll_paid',
  'job_assigned','job_unassigned','job_submitted','job_approved','job_rejected'
));

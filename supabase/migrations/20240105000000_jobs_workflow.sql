-- ============================================================
-- ChangPro v5 — Job workflow with before/after photos + inspection
-- ============================================================

-- ─── Extend jobs table for workflow ─────────────────────────
ALTER TABLE jobs
  -- Separate photo arrays (replaces generic `images`)
  ADD COLUMN IF NOT EXISTS before_photos    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS after_photos     TEXT[] NOT NULL DEFAULT '{}',

  -- Workflow timestamps
  ADD COLUMN IF NOT EXISTS started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,

  -- Inspection
  ADD COLUMN IF NOT EXISTS inspected_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_note  TEXT,
  ADD COLUMN IF NOT EXISTS rejection_count  INTEGER NOT NULL DEFAULT 0,

  -- Customer
  ADD COLUMN IF NOT EXISTS customer_name    TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone   TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,

  -- Work details
  ADD COLUMN IF NOT EXISTS work_summary     TEXT,
  ADD COLUMN IF NOT EXISTS materials_used   TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS actual_cost      NUMERIC(12,2),

  -- Time tracking
  ADD COLUMN IF NOT EXISTS labor_hours      NUMERIC(6,2);

-- ─── Expand status enum: awaiting_inspection + rejected ─────
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN (
  'pending',              -- รอช่างเริ่มงาน
  'inprogress',           -- ช่างกำลังทำ
  'awaiting_inspection',  -- ส่งงานแล้ว รอตรวจ
  'approved',             -- ตรวจผ่าน — งานเสร็จ
  'rejected',             -- ตรวจไม่ผ่าน — ต้องแก้
  'done',                 -- กรณีไม่ต้องตรวจ (backward compat)
  'cancelled'             -- ยกเลิก
));

CREATE INDEX IF NOT EXISTS idx_jobs_status_org   ON jobs (org_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_status ON jobs (assigned_to, status);

-- ─── STORAGE BUCKET for job photos ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos', 'job-photos', true, 10485760,  -- 10MB
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "job_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "job_photos_read"   ON storage.objects;

CREATE POLICY "job_photos_upload" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-photos' AND
    auth.uid() IS NOT NULL
  );
CREATE POLICY "job_photos_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);
CREATE POLICY "job_photos_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-photos' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager'))
  );

-- ─── TRIGGER: notify on job events ──────────────────────────
CREATE OR REPLACE FUNCTION notify_job_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tech_profile_id  UUID;
  v_admin_id         UUID;
  v_tech_name        TEXT;
  v_kind             TEXT;
  v_title            TEXT;
  v_body             TEXT;
BEGIN
  -- INSERT: job assigned to a technician
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

  -- UPDATE: status transitions worth notifying
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    SELECT full_name INTO v_tech_name FROM employees WHERE id = NEW.assigned_to;

    -- Tech submitted for inspection → notify admins
    IF NEW.status = 'awaiting_inspection' THEN
      v_kind  := 'job_submitted';
      v_title := '🔔 งานรอตรวจ';
      v_body  := COALESCE(v_tech_name, 'ช่าง') || ' ส่งงาน "' || NEW.title || '" รอตรวจ';

      FOR v_admin_id IN
        SELECT id FROM profiles WHERE org_id = NEW.org_id AND role IN ('admin','manager')
      LOOP
        INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
        VALUES (NEW.org_id, v_admin_id, v_kind, v_title, v_body,
          jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code,
            'employee_id', NEW.assigned_to, 'employee_name', v_tech_name));
      END LOOP;

    -- Inspection approved → notify tech
    ELSIF NEW.status = 'approved' THEN
      SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
      IF v_tech_profile_id IS NOT NULL THEN
        INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
        VALUES (
          NEW.org_id, v_tech_profile_id, 'job_approved',
          '✅ งานผ่านการตรวจ',
          'งาน "' || NEW.title || '" ผ่านการตรวจเรียบร้อย',
          jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code)
        );
      END IF;

    -- Inspection rejected → notify tech with reason
    ELSIF NEW.status = 'rejected' THEN
      SELECT id INTO v_tech_profile_id FROM profiles WHERE employee_id = NEW.assigned_to;
      IF v_tech_profile_id IS NOT NULL THEN
        INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
        VALUES (
          NEW.org_id, v_tech_profile_id, 'job_rejected',
          '⚠️ งานไม่ผ่านการตรวจ',
          'งาน "' || NEW.title || '" — ' || COALESCE(NEW.inspection_note, 'กรุณาแก้ไข'),
          jsonb_build_object('job_id', NEW.id, 'job_code', NEW.job_code,
            'inspection_note', NEW.inspection_note)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_assigned ON jobs;
DROP TRIGGER IF EXISTS trg_notify_job_status   ON jobs;
CREATE TRIGGER trg_notify_job_assigned AFTER INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION notify_job_event();
CREATE TRIGGER trg_notify_job_status AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION notify_job_event();

-- ─── Add new notification kinds ─────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
  'clock_in','clock_out','geofence_exit','geofence_return','long_idle',
  'payroll_approved','payroll_paid',
  'job_assigned','job_submitted','job_approved','job_rejected'
));

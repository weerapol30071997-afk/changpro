-- ============================================================
-- ChangPro v2 — GPS tracking, photo verification, notifications
-- ============================================================

-- ─── GEOFENCED WORK SITES ────────────────────────────────────
-- A "site" is a location where work happens. Time logs are anchored to a site.
CREATE TABLE work_sites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  lat         NUMERIC(10,6) NOT NULL,
  lng         NUMERIC(10,6) NOT NULL,
  radius_m    INTEGER NOT NULL DEFAULT 150 CHECK (radius_m > 0),  -- geofence radius in meters
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sites_org_active ON work_sites (org_id, is_active);

-- ─── TIME LOGS — extend with photo + site link ──────────────
ALTER TABLE time_logs
  ADD COLUMN IF NOT EXISTS site_id              UUID REFERENCES work_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clock_in_accuracy_m  NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS clock_out_accuracy_m NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS clock_in_device      TEXT,
  ADD COLUMN IF NOT EXISTS clock_out_device     TEXT;

-- Photo URL columns already exist from v1 schema (clock_in_photo_url, clock_out_photo_url)
-- Add NOT NULL constraints for new rows (existing rows can be NULL during migration)
-- CHECK constraint enforced at app level so old rows don't break

-- ─── LIVE LOCATION TRACKS ────────────────────────────────────
-- Periodic location pings sent by employee app while clocked in.
-- We only retain the latest 100 points per session for storage efficiency.
CREATE TABLE location_tracks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  time_log_id  UUID NOT NULL REFERENCES time_logs(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  lat          NUMERIC(10,6) NOT NULL,
  lng          NUMERIC(10,6) NOT NULL,
  accuracy_m   NUMERIC(8,2),
  speed_mps    NUMERIC(8,2),
  battery_pct  SMALLINT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tracks_log_time     ON location_tracks (time_log_id, recorded_at DESC);
CREATE INDEX idx_tracks_employee_time ON location_tracks (employee_id, recorded_at DESC);

-- Auto-trim old tracks to most recent 100 per session
CREATE OR REPLACE FUNCTION trim_location_tracks()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM location_tracks
  WHERE time_log_id = NEW.time_log_id
    AND id NOT IN (
      SELECT id FROM location_tracks
      WHERE time_log_id = NEW.time_log_id
      ORDER BY recorded_at DESC LIMIT 100
    );
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_trim_tracks AFTER INSERT ON location_tracks
  FOR EACH ROW EXECUTE FUNCTION trim_location_tracks();

-- ─── NOTIFICATIONS ───────────────────────────────────────────
-- Stored events that the app/push system delivers to recipients.
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN (
    'clock_in',         -- พนักงานเข้างาน
    'clock_out',        -- พนักงานออกงาน
    'geofence_exit',    -- ออกจากพื้นที่ลงเวลา
    'geofence_return',  -- กลับเข้าพื้นที่
    'long_idle',        -- ไม่มีการ ping นาน
    'payroll_approved', -- สลิปได้รับการอนุมัติ
    'payroll_paid',     -- จ่ายเงินเดือนแล้ว
    'job_assigned'      -- ได้รับมอบหมายงาน
  )),
  title        TEXT NOT NULL,
  body         TEXT,
  data         JSONB NOT NULL DEFAULT '{}',   -- {employee_id, lat, lng, site_id, ...}
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_recipient_unread ON notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX idx_notif_recipient_all    ON notifications (recipient_id, created_at DESC);

-- ─── PUSH SUBSCRIPTIONS (Web Push API) ───────────────────────
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_push_user ON push_subscriptions (user_id);

-- ─── HELPER: distance between two GPS points (Haversine, meters) ──
CREATE OR REPLACE FUNCTION distance_meters(
  lat1 NUMERIC, lng1 NUMERIC, lat2 NUMERIC, lng2 NUMERIC
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  R       NUMERIC := 6371000;   -- earth radius (m)
  dlat    NUMERIC;
  dlng    NUMERIC;
  a       NUMERIC;
  c       NUMERIC;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;
  dlat := RADIANS(lat2 - lat1);
  dlng := RADIANS(lng2 - lng1);
  a := SIN(dlat/2)^2 + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2)^2;
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  RETURN R * c;
END;
$$;

-- ─── TRIGGER: notify admins on clock_in / clock_out ──────────
CREATE OR REPLACE FUNCTION notify_clock_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_emp_name      TEXT;
  v_admin_id      UUID;
  v_kind          TEXT;
  v_title         TEXT;
  v_body          TEXT;
  v_lat           NUMERIC;
  v_lng           NUMERIC;
  v_site_name     TEXT;
BEGIN
  -- Clock in (INSERT)
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_emp_name FROM employees WHERE id = NEW.employee_id;

    v_kind  := 'clock_in';
    v_title := 'พนักงานเข้างาน';
    v_lat   := NEW.clock_in_lat;
    v_lng   := NEW.clock_in_lng;

    IF NEW.site_id IS NOT NULL THEN
      SELECT name INTO v_site_name FROM work_sites WHERE id = NEW.site_id;
      v_body := v_emp_name || ' เข้างานที่ ' || v_site_name;
    ELSE
      v_body := v_emp_name || ' เข้างานแล้ว';
    END IF;

  -- Clock out (UPDATE with new clock_out)
  ELSIF TG_OP = 'UPDATE' AND OLD.clock_out IS NULL AND NEW.clock_out IS NOT NULL THEN
    SELECT full_name INTO v_emp_name FROM employees WHERE id = NEW.employee_id;
    v_kind  := 'clock_out';
    v_title := 'พนักงานออกงาน';
    v_body  := v_emp_name || ' ออกงานเรียบร้อย';
    v_lat   := NEW.clock_out_lat;
    v_lng   := NEW.clock_out_lng;
  ELSE
    RETURN NEW;
  END IF;

  -- Fan out to all admin/manager in same org
  FOR v_admin_id IN
    SELECT id FROM profiles WHERE org_id = NEW.org_id AND role IN ('admin','manager')
  LOOP
    INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
    VALUES (
      NEW.org_id, v_admin_id, v_kind, v_title, v_body,
      jsonb_build_object(
        'time_log_id', NEW.id,
        'employee_id', NEW.employee_id,
        'employee_name', v_emp_name,
        'lat', v_lat, 'lng', v_lng,
        'site_id', NEW.site_id,
        'site_name', v_site_name
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_clock_in  AFTER INSERT ON time_logs
  FOR EACH ROW EXECUTE FUNCTION notify_clock_event();
CREATE TRIGGER trg_notify_clock_out AFTER UPDATE ON time_logs
  FOR EACH ROW EXECUTE FUNCTION notify_clock_event();

-- ─── TRIGGER: geofence breach detection on location ping ─────
-- When a track point is recorded, check if it's outside the site's geofence.
-- Generates 'geofence_exit' / 'geofence_return' notifications.
CREATE OR REPLACE FUNCTION check_geofence()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_site_id        UUID;
  v_site_lat       NUMERIC;
  v_site_lng       NUMERIC;
  v_radius         INTEGER;
  v_site_name      TEXT;
  v_dist           NUMERIC;
  v_emp_name       TEXT;
  v_last_status    TEXT;  -- 'inside' | 'outside' | NULL
  v_current_status TEXT;
  v_admin_id       UUID;
  v_kind           TEXT;
  v_title          TEXT;
  v_body           TEXT;
BEGIN
  -- Get the site this session is anchored to
  SELECT tl.site_id INTO v_site_id FROM time_logs tl WHERE tl.id = NEW.time_log_id;
  IF v_site_id IS NULL THEN RETURN NEW; END IF;

  SELECT lat, lng, radius_m, name INTO v_site_lat, v_site_lng, v_radius, v_site_name
  FROM work_sites WHERE id = v_site_id;

  v_dist := distance_meters(NEW.lat, NEW.lng, v_site_lat, v_site_lng);
  v_current_status := CASE WHEN v_dist <= v_radius THEN 'inside' ELSE 'outside' END;

  -- Find previous track point's status for this session
  SELECT CASE WHEN distance_meters(lat, lng, v_site_lat, v_site_lng) <= v_radius
              THEN 'inside' ELSE 'outside' END
  INTO v_last_status
  FROM location_tracks
  WHERE time_log_id = NEW.time_log_id AND id != NEW.id
  ORDER BY recorded_at DESC LIMIT 1;

  -- No change → no notification
  IF v_last_status IS NOT NULL AND v_last_status = v_current_status THEN
    RETURN NEW;
  END IF;

  -- Status changed → notify
  SELECT full_name INTO v_emp_name FROM employees WHERE id = NEW.employee_id;
  IF v_current_status = 'outside' THEN
    v_kind  := 'geofence_exit';
    v_title := '⚠️ พนักงานออกจากพื้นที่';
    v_body  := v_emp_name || ' ออกจาก ' || v_site_name || ' (' || ROUND(v_dist) || ' ม.)';
  ELSE
    v_kind  := 'geofence_return';
    v_title := '✅ พนักงานกลับเข้าพื้นที่';
    v_body  := v_emp_name || ' กลับเข้า ' || v_site_name;
  END IF;

  FOR v_admin_id IN
    SELECT id FROM profiles WHERE org_id = NEW.org_id AND role IN ('admin','manager')
  LOOP
    INSERT INTO notifications (org_id, recipient_id, kind, title, body, data)
    VALUES (NEW.org_id, v_admin_id, v_kind, v_title, v_body,
      jsonb_build_object(
        'time_log_id', NEW.time_log_id,
        'employee_id', NEW.employee_id,
        'employee_name', v_emp_name,
        'site_id', v_site_id, 'site_name', v_site_name,
        'lat', NEW.lat, 'lng', NEW.lng,
        'distance_m', ROUND(v_dist)
      ));
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_geofence AFTER INSERT ON location_tracks
  FOR EACH ROW EXECUTE FUNCTION check_geofence();

-- ─── RLS for new tables ──────────────────────────────────────
ALTER TABLE work_sites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_tracks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sites_read"  ON work_sites FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "sites_write" ON work_sites FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "tracks_employee_insert" ON location_tracks FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND employee_id = auth_employee_id());
CREATE POLICY "tracks_read" ON location_tracks FOR SELECT
  USING (
    org_id = auth_org_id() AND (
      employee_id = auth_employee_id() OR
      auth_role() IN ('admin','manager')
    )
  );

CREATE POLICY "notif_own_read"   ON notifications FOR SELECT
  USING (recipient_id = auth.uid());
CREATE POLICY "notif_own_update" ON notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "push_own" ON push_subscriptions FOR ALL
  USING (user_id = auth.uid());

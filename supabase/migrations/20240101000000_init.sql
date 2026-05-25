-- ============================================================
-- ChangPro Database Schema
-- Run: supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- ─── ORGANIZATIONS ───────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  logo_url    TEXT,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PROFILES (extends auth.users) ───────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','manager','employee')),
  employee_id UUID,  -- FK added after employees table
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EMPLOYEES ───────────────────────────────────────────────
CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code     TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  nickname          TEXT,
  avatar_url        TEXT,
  role              TEXT NOT NULL DEFAULT 'ช่างทั่วไป',
  phone             TEXT,
  email             TEXT,
  line_user_id      TEXT,
  address           TEXT,
  start_date        DATE,
  end_date          DATE,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','leave','off','resigned')),
  bank_name         TEXT,
  bank_account      TEXT,
  bank_account_name TEXT,
  base_salary       NUMERIC(12,2) NOT NULL DEFAULT 0,
  daily_rate        NUMERIC(12,2),   -- NULL = auto-compute
  hourly_rate       NUMERIC(12,4),   -- NULL = auto-compute
  ot_multiplier     NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  sso_rate          NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  tax_rate          NUMERIC(5,2) NOT NULL DEFAULT 0.0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, employee_code)
);

-- Add FK back to profiles
ALTER TABLE profiles
  ADD CONSTRAINT profiles_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

-- ─── TIME LOGS ───────────────────────────────────────────────
CREATE TABLE time_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  clock_in            TIMESTAMPTZ NOT NULL,
  clock_out           TIMESTAMPTZ,
  clock_in_lat        NUMERIC(10,6),
  clock_in_lng        NUMERIC(10,6),
  clock_out_lat       NUMERIC(10,6),
  clock_out_lng       NUMERIC(10,6),
  clock_in_photo_url  TEXT,
  clock_out_photo_url TEXT,
  note                TEXT,
  approved_by         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','approved','rejected')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate open sessions
  CONSTRAINT no_open_overlap EXCLUDE USING gist (
    employee_id WITH =,
    tstzrange(clock_in, COALESCE(clock_out, 'infinity')) WITH &&
  ) WHERE (clock_out IS NULL)
);

CREATE INDEX idx_time_logs_employee_date ON time_logs (employee_id, clock_in DESC);
CREATE INDEX idx_time_logs_org_date      ON time_logs (org_id, clock_in DESC);

-- ─── JOBS ────────────────────────────────────────────────────
CREATE TABLE jobs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_code     TEXT NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','inprogress','done','cancelled')),
  priority     TEXT NOT NULL DEFAULT 'normal'
               CHECK (priority IN ('low','normal','high','urgent')),
  location     TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  images       TEXT[] NOT NULL DEFAULT '{}',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, job_code)
);

CREATE INDEX idx_jobs_org_status     ON jobs (org_id, status);
CREATE INDEX idx_jobs_assigned       ON jobs (assigned_to, status);
CREATE INDEX idx_jobs_title_search   ON jobs USING gin (title gin_trgm_ops);

-- ─── PAYROLL PERIODS ─────────────────────────────────────────
CREATE TABLE payroll_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  pay_date      DATE NOT NULL,
  pay_method    TEXT NOT NULL DEFAULT 'bank'
                CHECK (pay_method IN ('bank','cash','promptpay')),
  work_days     INTEGER NOT NULL DEFAULT 0,
  total_hours   NUMERIC(8,2) NOT NULL DEFAULT 0,
  ot_hours      NUMERIC(8,2) NOT NULL DEFAULT 0,
  base_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ot_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  sso_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  sso_rate      NUMERIC(5,2)  NOT NULL DEFAULT 5,
  tax_rate      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  ot_multiplier NUMERIC(4,2)  NOT NULL DEFAULT 1.5,
  allowances    JSONB NOT NULL DEFAULT '[]',
  deductions    JSONB NOT NULL DEFAULT '[]',
  day_breakdown JSONB NOT NULL DEFAULT '[]',
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','approved','paid')),
  approved_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  paid_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  paid_at       TIMESTAMPTZ,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_period  CHECK (period_to >= period_from));


CREATE INDEX idx_payroll_org_date    ON payroll_periods (org_id, period_from DESC);
CREATE INDEX idx_payroll_employee    ON payroll_periods (employee_id, period_from DESC);
CREATE INDEX idx_payroll_status      ON payroll_periods (org_id, status);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','profiles','employees','time_logs','jobs','payroll_periods']
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END;
$$;

-- ─── AUTO-GENERATE CODES TRIGGER ─────────────────────────────
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_num INTEGER;
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    SELECT COUNT(*)+1 INTO next_num FROM employees WHERE org_id = NEW.org_id;
    NEW.employee_code := 'EMP' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_employee_code BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION generate_employee_code();

CREATE OR REPLACE FUNCTION generate_job_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE next_num INTEGER;
BEGIN
  IF NEW.job_code IS NULL OR NEW.job_code = '' THEN
    SELECT COUNT(*)+1 INTO next_num FROM jobs WHERE org_id = NEW.org_id;
    NEW.job_code := 'JOB' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_job_code BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION generate_job_code();

-- ─── PAYROLL COMPUTATION FUNCTION ────────────────────────────
CREATE OR REPLACE FUNCTION get_employee_hours(
  p_employee_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  rec           RECORD;
  v_work_days   INTEGER := 0;
  v_total_hours NUMERIC := 0;
  v_ot_hours    NUMERIC := 0;
  v_breakdown   JSONB := '[]';
  v_std_hrs     NUMERIC;
  v_ot_hrs      NUMERIC;
  v_raw_hrs     NUMERIC;
BEGIN
  FOR rec IN
    SELECT
      clock_in::DATE AS work_date,
      MIN(clock_in)  AS first_in,
      MAX(clock_out) AS last_out,
      SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, NOW()) - clock_in))/3600) AS raw_hrs
    FROM time_logs
    WHERE employee_id = p_employee_id
      AND clock_in::DATE BETWEEN p_from AND p_to
      AND clock_out IS NOT NULL
    GROUP BY clock_in::DATE
    ORDER BY clock_in::DATE
  LOOP
    v_raw_hrs   := rec.raw_hrs;
    v_std_hrs   := LEAST(v_raw_hrs, 8);
    v_ot_hrs    := GREATEST(v_raw_hrs - 8, 0);
    v_work_days := v_work_days + 1;
    v_total_hours := v_total_hours + v_std_hrs;
    v_ot_hours    := v_ot_hours    + v_ot_hrs;
    v_breakdown   := v_breakdown || jsonb_build_object(
      'date',      rec.work_date,
      'std_hrs',   ROUND(v_std_hrs::NUMERIC, 2),
      'ot_hrs',    ROUND(v_ot_hrs::NUMERIC,  2),
      'clock_in',  rec.first_in,
      'clock_out', rec.last_out
    );
  END LOOP;
  RETURN jsonb_build_object(
    'work_days',    v_work_days,
    'total_hours',  ROUND(v_total_hours::NUMERIC, 2),
    'ot_hours',     ROUND(v_ot_hours::NUMERIC,    2),
    'day_breakdown', v_breakdown
  );
END;
$$;

-- ─── VIEW: payroll summary ────────────────────────────────────
CREATE OR REPLACE VIEW payroll_summary AS
SELECT
  org_id,
  TO_CHAR(period_from, 'YYYY-MM') AS month,
  COUNT(*)                         AS total_employees,
  SUM(gross_amount)                AS total_gross,
  SUM(net_amount)                  AS total_net,
  SUM(CASE WHEN status='paid' THEN net_amount ELSE 0 END) AS total_paid,
  COUNT(CASE WHEN status='paid'  THEN 1 END) AS count_paid,
  COUNT(CASE WHEN status!='paid' THEN 1 END) AS count_pending
FROM payroll_periods
GROUP BY org_id, TO_CHAR(period_from, 'YYYY-MM');

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

-- Helper: get caller's org_id
CREATE OR REPLACE FUNCTION auth_org_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get caller's role
CREATE OR REPLACE FUNCTION auth_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get caller's employee_id
CREATE OR REPLACE FUNCTION auth_employee_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT employee_id FROM profiles WHERE id = auth.uid()
$$;

-- Organizations: only members can read
CREATE POLICY "org_member_read" ON organizations FOR SELECT
  USING (id = auth_org_id());

-- Profiles: same org
CREATE POLICY "profiles_same_org" ON profiles FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Employees: same org read; admin/manager write
CREATE POLICY "employees_read" ON employees FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "employees_write" ON employees FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

-- Time logs: employees see own, admin/manager see all in org
CREATE POLICY "timelogs_employee_read" ON time_logs FOR SELECT
  USING (
    org_id = auth_org_id() AND (
      employee_id = auth_employee_id() OR
      auth_role() IN ('admin','manager')
    )
  );
CREATE POLICY "timelogs_employee_insert" ON time_logs FOR INSERT
  WITH CHECK (
    org_id = auth_org_id() AND
    employee_id = auth_employee_id()
  );
CREATE POLICY "timelogs_employee_update" ON time_logs FOR UPDATE
  USING (
    org_id = auth_org_id() AND (
      (employee_id = auth_employee_id() AND clock_out IS NULL) OR
      auth_role() IN ('admin','manager')
    )
  );

-- Jobs: read all in org; write admin/manager only
CREATE POLICY "jobs_read" ON jobs FOR SELECT
  USING (org_id = auth_org_id());
CREATE POLICY "jobs_write" ON jobs FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));
-- Employees can update status of assigned jobs
CREATE POLICY "jobs_employee_status" ON jobs FOR UPDATE
  USING (
    org_id = auth_org_id() AND
    assigned_to = auth_employee_id()
  )
  WITH CHECK (status IN ('inprogress','done'));

-- Payroll: employees see own; admin/manager see all
CREATE POLICY "payroll_employee_read" ON payroll_periods FOR SELECT
  USING (
    org_id = auth_org_id() AND (
      employee_id = auth_employee_id() OR
      auth_role() IN ('admin','manager')
    )
  );
CREATE POLICY "payroll_manager_write" ON payroll_periods FOR ALL
  USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

-- ─── HANDLE NEW USER (on auth.users insert) ──────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id UUID;
  v_role   TEXT;
BEGIN
  -- Role and org come from user_metadata set during sign-up
  v_org_id := (NEW.raw_user_meta_data->>'org_id')::UUID;
  v_role   := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');

  INSERT INTO profiles (id, org_id, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    v_org_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── SEED: default org (first run) ───────────────────────────
-- Insert a default org — update before deploy
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'ช่างโปร Demo',
  'changpro-demo',
  '{"timezone": "Asia/Bangkok", "currency": "THB", "work_hours_per_day": 8, "work_days_per_month": 26}'
) ON CONFLICT (slug) DO NOTHING;

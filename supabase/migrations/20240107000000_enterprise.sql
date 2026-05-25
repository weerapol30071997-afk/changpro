-- ============================================================
-- ChangPro v7 — Enterprise upgrade
--   ◆ Customer CRM           — proper customer management
--   ◆ Service catalog        — reusable job templates
--   ◆ Holiday calendar       — for OT premium pay calculation
--   ◆ Leave management       — request/approval workflow
--   ◆ Materials inventory    — stock + per-job consumption
--   ◆ Customer ratings       — quality feedback (1-5★)
--   ◆ Audit log              — track all changes
--   ◆ Documents              — employee/job file storage
--   ◆ Org settings           — configurable work rules
-- ============================================================

-- ─── ORG SETTINGS (extend organization config) ──────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS address         TEXT,
  ADD COLUMN IF NOT EXISTS tax_id          TEXT,
  ADD COLUMN IF NOT EXISTS website         TEXT,
  ADD COLUMN IF NOT EXISTS work_start_time TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end_time   TIME DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS break_minutes   INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS workweek        TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat']::TEXT[],
  ADD COLUMN IF NOT EXISTS holiday_ot_rate NUMERIC(4,2) DEFAULT 3.0,    -- OT × วันหยุด
  ADD COLUMN IF NOT EXISTS holiday_pay_rate NUMERIC(4,2) DEFAULT 2.0,   -- ค่าทำงานวันหยุด ×
  ADD COLUMN IF NOT EXISTS currency        TEXT DEFAULT 'THB',
  ADD COLUMN IF NOT EXISTS timezone        TEXT DEFAULT 'Asia/Bangkok';

-- ─── CUSTOMERS (proper CRM) ──────────────────────────────────
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_code   TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'individual'
                  CHECK (type IN ('individual','business')),
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  line_id         TEXT,
  address         TEXT,
  district        TEXT,
  province        TEXT,
  postcode        TEXT,
  lat             NUMERIC(10,6),
  lng             NUMERIC(10,6),
  tax_id          TEXT,
  notes           TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',  -- ['VIP','ขาประจำ','ระวัง']
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  total_jobs      INTEGER NOT NULL DEFAULT 0,    -- denormalized counter
  total_revenue   NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_rating      NUMERIC(3,2),                  -- 0-5 stars
  last_job_at     TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, customer_code)
);
CREATE INDEX idx_customers_org_active ON customers (org_id, is_active);
CREATE INDEX idx_customers_name_trgm  ON customers USING gin (name gin_trgm_ops);
CREATE INDEX idx_customers_phone      ON customers (phone);

-- Auto-generate customer_code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    SELECT COUNT(*)+1 INTO n FROM customers WHERE org_id = NEW.org_id;
    NEW.customer_code := 'CUS' || LPAD(n::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_customer_code BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── SERVICE CATALOG ─────────────────────────────────────────
CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,                                   -- ไฟฟ้า, ประปา, แอร์, etc.
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'งาน',           -- งาน, ชั่วโมง, ตร.ม., ดวง
  est_duration_min INTEGER,                            -- ประมาณการเวลา
  default_priority TEXT DEFAULT 'normal'
                  CHECK (default_priority IN ('low','normal','high','urgent')),
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  use_count     INTEGER NOT NULL DEFAULT 0,            -- popularity tracking
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, code)
);
CREATE INDEX idx_services_org_active ON services (org_id, is_active);
CREATE INDEX idx_services_category   ON services (org_id, category);
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── HOLIDAYS ────────────────────────────────────────────────
CREATE TABLE holidays (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'public'
              CHECK (kind IN ('public','company','religious')),
  is_paid     BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, date)
);
CREATE INDEX idx_holidays_org_date ON holidays (org_id, date);

-- Seed common Thai 2024-2026 public holidays into default org
INSERT INTO holidays (org_id, date, name, kind) VALUES
  ('00000000-0000-0000-0000-000000000001', '2026-01-01', 'วันขึ้นปีใหม่', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-02-12', 'วันมาฆบูชา', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-04-06', 'วันจักรี', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-04-13', 'วันสงกรานต์', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-04-14', 'วันสงกรานต์', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-04-15', 'วันสงกรานต์', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-05-01', 'วันแรงงานแห่งชาติ', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-05-04', 'วันฉัตรมงคล', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-05-11', 'วันวิสาขบูชา', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-06-03', 'วันเฉลิมพระชนมพรรษา ราชินี', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-07-09', 'วันอาสาฬหบูชา', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-07-28', 'วันเฉลิมพระชนมพรรษา รัชกาลที่ 10', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-08-12', 'วันแม่แห่งชาติ', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-10-13', 'วันคล้ายวันสวรรคต รัชกาลที่ 9', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-10-23', 'วันปิยมหาราช', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-12-05', 'วันพ่อแห่งชาติ', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-12-10', 'วันรัฐธรรมนูญ', 'public'),
  ('00000000-0000-0000-0000-000000000001', '2026-12-31', 'วันสิ้นปี', 'public')
ON CONFLICT DO NOTHING;

-- ─── LEAVE REQUESTS ─────────────────────────────────────────
CREATE TABLE leave_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                CHECK (kind IN ('vacation','sick','personal','maternity','bereavement','unpaid','other')),
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  total_days    NUMERIC(4,1) NOT NULL,
  reason        TEXT NOT NULL,
  attachments   TEXT[] NOT NULL DEFAULT '{}',        -- doctor cert, etc.
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_leave_range CHECK (end_date >= start_date)
);
CREATE INDEX idx_leaves_employee  ON leave_requests (employee_id, start_date DESC);
CREATE INDEX idx_leaves_org_status ON leave_requests (org_id, status);
CREATE TRIGGER trg_leaves_updated_at BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── MATERIALS / INVENTORY ──────────────────────────────────
CREATE TABLE materials (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT,                                -- สายไฟ, ท่อ, เครื่องมือ, etc.
  unit            TEXT NOT NULL DEFAULT 'ชิ้น',
  unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,    -- ราคาทุน
  unit_price      NUMERIC(12,2),                       -- ราคาขายต่อหน่วย (NULL = ไม่ขาย)
  stock_qty       NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(12,2) NOT NULL DEFAULT 0,    -- alert ต่ำกว่านี้
  location        TEXT,                                -- โกดัง/ชั้น
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, code)
);
CREATE INDEX idx_materials_org_active ON materials (org_id, is_active);
CREATE INDEX idx_materials_low_stock  ON materials (org_id) WHERE stock_qty <= min_stock;
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Material movements (in/out/adjustment)
CREATE TABLE material_movements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('in','out','adjustment','job_consume')),
  quantity      NUMERIC(12,2) NOT NULL,                -- positive=in, negative=out
  unit_cost     NUMERIC(12,2),                         -- at time of movement
  reference_id  UUID,                                  -- could be job_id, etc.
  reference_kind TEXT,                                 -- 'job','purchase','adjustment'
  note          TEXT,
  performed_by  UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movements_material ON material_movements (material_id, created_at DESC);
CREATE INDEX idx_movements_org      ON material_movements (org_id, created_at DESC);

-- Trigger: update material stock_qty on movement
CREATE OR REPLACE FUNCTION update_material_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE materials
  SET stock_qty = stock_qty + NEW.quantity
  WHERE id = NEW.material_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_material_stock AFTER INSERT ON material_movements
  FOR EACH ROW EXECUTE FUNCTION update_material_stock();

-- ─── JOB ↔ CUSTOMER / SERVICE / MATERIALS ───────────────────
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS materials_used_json JSONB NOT NULL DEFAULT '[]',  -- [{material_id, qty, cost}]
  ADD COLUMN IF NOT EXISTS labor_cost      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS materials_cost  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS profit          NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_service  ON jobs (service_id);

-- Job-materials junction (alternative to JSONB for normalized querying)
CREATE TABLE job_materials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES materials(id),
  quantity      NUMERIC(12,2) NOT NULL,
  unit_cost     NUMERIC(12,2) NOT NULL,
  total_cost    NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, material_id)
);
CREATE INDEX idx_job_materials_job ON job_materials (job_id);

-- ─── CUSTOMER RATINGS ───────────────────────────────────────
CREATE TABLE ratings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  -- Star ratings (1-5)
  overall       SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  quality       SMALLINT CHECK (quality BETWEEN 1 AND 5),
  punctuality   SMALLINT CHECK (punctuality BETWEEN 1 AND 5),
  professionalism SMALLINT CHECK (professionalism BETWEEN 1 AND 5),
  cleanliness   SMALLINT CHECK (cleanliness BETWEEN 1 AND 5),
  comment       TEXT,
  recommended   BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id)
);
CREATE INDEX idx_ratings_employee ON ratings (employee_id);
CREATE INDEX idx_ratings_customer ON ratings (customer_id);

-- Recalculate customer avg_rating on new rating
CREATE OR REPLACE FUNCTION update_customer_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET avg_rating = (
      SELECT ROUND(AVG(overall)::NUMERIC, 2) FROM ratings WHERE customer_id = NEW.customer_id
    )
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_update_customer_rating AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_customer_rating();

-- ─── AUDIT LOG ──────────────────────────────────────────────
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name    TEXT,                                  -- snapshot
  action        TEXT NOT NULL,                         -- 'create','update','delete','approve', etc.
  entity_kind   TEXT NOT NULL,                         -- 'employee','job','payroll', etc.
  entity_id     UUID,
  entity_label  TEXT,                                  -- human readable (job title, etc.)
  changes       JSONB NOT NULL DEFAULT '{}',           -- {field: {old, new}}
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_org_date    ON audit_log (org_id, created_at DESC);
CREATE INDEX idx_audit_entity      ON audit_log (entity_kind, entity_id);
CREATE INDEX idx_audit_actor       ON audit_log (actor_id, created_at DESC);

-- ─── DOCUMENTS (employee files, job photos, customer attachments) ──
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_kind    TEXT NOT NULL CHECK (owner_kind IN ('employee','job','customer','org')),
  owner_id      UUID NOT NULL,
  name          TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  category      TEXT,                                  -- 'id_card','contract','quotation','invoice'
  uploaded_by   UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_owner ON documents (owner_kind, owner_id);

-- ─── EMPLOYEE PERFORMANCE / STATS (denormalized) ────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS total_jobs_done      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_jobs_rejected  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating           NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS total_revenue_earned NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_balance_vacation NUMERIC(4,1) NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS leave_balance_sick     NUMERIC(4,1) NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS leave_balance_personal NUMERIC(4,1) NOT NULL DEFAULT 3;

-- Update employee performance on job approval
CREATE OR REPLACE FUNCTION update_employee_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.assigned_to IS NOT NULL THEN
    UPDATE employees
    SET total_jobs_done      = total_jobs_done + 1,
        total_revenue_earned = total_revenue_earned + COALESCE(NEW.actual_cost, 0)
    WHERE id = NEW.assigned_to;
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' AND NEW.assigned_to IS NOT NULL THEN
    UPDATE employees SET total_jobs_rejected = total_jobs_rejected + 1
    WHERE id = NEW.assigned_to;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_update_employee_stats AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_employee_stats();

-- Update customer total_jobs / total_revenue on job approval
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_jobs    = total_jobs + 1,
        total_revenue = total_revenue + COALESCE(NEW.actual_cost, 0),
        last_job_at   = NOW()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_update_customer_stats AFTER UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_customer_stats();

-- Update employee avg_rating on new rating
CREATE OR REPLACE FUNCTION update_employee_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employee_id IS NOT NULL THEN
    UPDATE employees
    SET avg_rating = (
      SELECT ROUND(AVG(overall)::NUMERIC, 2) FROM ratings WHERE employee_id = NEW.employee_id
    )
    WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_update_employee_rating AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_employee_rating();

-- ─── RLS POLICIES ───────────────────────────────────────────
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials          ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_materials      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;

-- Customers, services, holidays, materials: read all in org, write admin/manager
CREATE POLICY "customers_read"  ON customers FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "customers_write" ON customers FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "services_read"   ON services FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "services_write"  ON services FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "holidays_read"   ON holidays FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "holidays_write"  ON holidays FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "materials_read"  ON materials FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "materials_write" ON materials FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "movements_read"  ON material_movements FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "movements_write" ON material_movements FOR INSERT WITH CHECK (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

CREATE POLICY "job_materials_read"  ON job_materials FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "job_materials_write" ON job_materials FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

-- Leave: employees see own, admin sees all
CREATE POLICY "leaves_employee_read" ON leave_requests FOR SELECT
  USING (org_id = auth_org_id() AND (employee_id = auth_employee_id() OR auth_role() IN ('admin','manager')));
CREATE POLICY "leaves_employee_insert" ON leave_requests FOR INSERT
  WITH CHECK (org_id = auth_org_id() AND employee_id = auth_employee_id());
CREATE POLICY "leaves_employee_update" ON leave_requests FOR UPDATE
  USING (org_id = auth_org_id() AND (
    (employee_id = auth_employee_id() AND status = 'pending') OR
    auth_role() IN ('admin','manager')
  ));

-- Ratings: read all in org
CREATE POLICY "ratings_read"  ON ratings FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "ratings_write" ON ratings FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

-- Audit log: only admin can read
CREATE POLICY "audit_read"  ON audit_log FOR SELECT USING (org_id = auth_org_id() AND auth_role() = 'admin');
CREATE POLICY "audit_write" ON audit_log FOR INSERT WITH CHECK (org_id = auth_org_id());

-- Documents: read in org, write admin
CREATE POLICY "documents_read"  ON documents FOR SELECT USING (org_id = auth_org_id());
CREATE POLICY "documents_write" ON documents FOR ALL    USING (org_id = auth_org_id() AND auth_role() IN ('admin','manager'));

-- ─── ANALYTICS VIEWS ────────────────────────────────────────
-- Job stats per employee
CREATE OR REPLACE VIEW employee_performance AS
SELECT
  e.id, e.org_id, e.full_name, e.role,
  e.total_jobs_done, e.total_jobs_rejected, e.avg_rating,
  e.total_revenue_earned,
  CASE WHEN (e.total_jobs_done + e.total_jobs_rejected) > 0
    THEN ROUND((e.total_jobs_done::NUMERIC / (e.total_jobs_done + e.total_jobs_rejected)) * 100, 1)
    ELSE NULL END AS success_rate_pct,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status IN ('inprogress','awaiting_inspection','rejected')) AS active_jobs,
  COUNT(DISTINCT j.id) FILTER (WHERE j.created_at > NOW() - INTERVAL '30 days') AS jobs_last_30d
FROM employees e
LEFT JOIN jobs j ON j.assigned_to = e.id
GROUP BY e.id;

-- Monthly revenue summary
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT
  j.org_id,
  TO_CHAR(j.completed_at, 'YYYY-MM') AS month,
  COUNT(*)                            AS jobs_count,
  SUM(j.actual_cost)                  AS revenue,
  SUM(j.materials_cost)               AS materials_cost,
  SUM(j.labor_cost)                   AS labor_cost,
  SUM(j.profit)                       AS profit,
  ROUND(AVG(j.actual_cost), 2)        AS avg_job_value
FROM jobs j
WHERE j.status = 'approved' AND j.completed_at IS NOT NULL
GROUP BY j.org_id, TO_CHAR(j.completed_at, 'YYYY-MM');

-- Customer LTV
CREATE OR REPLACE VIEW customer_ltv AS
SELECT
  c.id, c.org_id, c.name, c.customer_code,
  c.total_jobs, c.total_revenue, c.avg_rating, c.last_job_at,
  CASE
    WHEN c.total_revenue > 100000 THEN 'platinum'
    WHEN c.total_revenue > 30000  THEN 'gold'
    WHEN c.total_revenue > 5000   THEN 'silver'
    ELSE 'bronze'
  END AS tier
FROM customers c;

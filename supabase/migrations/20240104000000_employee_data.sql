-- ============================================================
-- ChangPro v4 — Extended employee data + multiple payment types
-- ============================================================

-- ─── Add payment type enum + employment fields ─────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS payment_type             TEXT NOT NULL DEFAULT 'monthly'
    CHECK (payment_type IN ('daily','monthly','hourly')),
  ADD COLUMN IF NOT EXISTS employment_type          TEXT NOT NULL DEFAULT 'fulltime'
    CHECK (employment_type IN ('fulltime','parttime','contract','daily','probation')),
  ADD COLUMN IF NOT EXISTS position_level           TEXT DEFAULT 'general'
    CHECK (position_level IN ('intern','junior','mid','senior','lead','foreman','manager','general')),
  ADD COLUMN IF NOT EXISTS department               TEXT,
  ADD COLUMN IF NOT EXISTS probation_end_date       DATE,
  ADD COLUMN IF NOT EXISTS standard_days_per_month  INTEGER NOT NULL DEFAULT 26
    CHECK (standard_days_per_month BETWEEN 20 AND 31),
  ADD COLUMN IF NOT EXISTS standard_hours_per_day   INTEGER NOT NULL DEFAULT 8
    CHECK (standard_hours_per_day BETWEEN 1 AND 24);

-- ─── Personal info ──────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS national_id              TEXT,
  ADD COLUMN IF NOT EXISTS birth_date               DATE,
  ADD COLUMN IF NOT EXISTS gender                   TEXT CHECK (gender IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS nationality              TEXT DEFAULT 'ไทย',
  ADD COLUMN IF NOT EXISTS marital_status           TEXT
    CHECK (marital_status IN ('single','married','divorced','widowed')),
  ADD COLUMN IF NOT EXISTS religion                 TEXT,
  ADD COLUMN IF NOT EXISTS registered_address       TEXT;

-- ─── Emergency contact ──────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS emergency_contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- ─── Government IDs ─────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS social_security_number   TEXT,
  ADD COLUMN IF NOT EXISTS tax_id                    TEXT;

-- ─── Skills / certifications (for trade workers) ───────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS skills                    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications            JSONB NOT NULL DEFAULT '[]', -- [{name, issuer, expires_at}]
  ADD COLUMN IF NOT EXISTS license_numbers           JSONB NOT NULL DEFAULT '[]'; -- [{type, number, expires_at}]

-- ─── Benefits ───────────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS has_health_insurance      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_life_insurance        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vacation_days_per_year    INTEGER NOT NULL DEFAULT 6
    CHECK (vacation_days_per_year >= 0),
  ADD COLUMN IF NOT EXISTS sick_days_per_year        INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS personal_days_per_year    INTEGER NOT NULL DEFAULT 3;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS notes                     TEXT;

-- ─── Indexes for new searchable fields ─────────────────────
CREATE INDEX IF NOT EXISTS idx_employees_payment_type ON employees (org_id, payment_type);
CREATE INDEX IF NOT EXISTS idx_employees_department   ON employees (org_id, department);
CREATE INDEX IF NOT EXISTS idx_employees_national_id  ON employees (national_id);

-- ─── Validation: Thai national ID checksum (optional helper) ──
CREATE OR REPLACE FUNCTION is_valid_thai_national_id(p TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits   INTEGER[];
  i        INTEGER;
  sum      INTEGER := 0;
  checksum INTEGER;
BEGIN
  IF p IS NULL OR LENGTH(p) != 13 OR p !~ '^[0-9]{13}$' THEN RETURN FALSE; END IF;
  FOR i IN 1..13 LOOP digits[i] := SUBSTRING(p, i, 1)::INTEGER; END LOOP;
  FOR i IN 1..12 LOOP sum := sum + digits[i] * (14 - i); END LOOP;
  checksum := (11 - (sum % 11)) % 10;
  RETURN checksum = digits[13];
END;
$$;

-- ─── Update payroll period schema for richer breakdown ─────
ALTER TABLE payroll_periods
  ADD COLUMN IF NOT EXISTS payment_type             TEXT,
  ADD COLUMN IF NOT EXISTS daily_rate_used          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS hourly_rate_used         NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS period_calendar_days     INTEGER,    -- e.g. 30 days
  ADD COLUMN IF NOT EXISTS period_work_days         INTEGER,    -- expected work days
  ADD COLUMN IF NOT EXISTS prorate_method           TEXT DEFAULT 'work_days'
    CHECK (prorate_method IN ('full','work_days','calendar_days','manual'));

-- ─── Smart compute function: takes payment_type into account ─
CREATE OR REPLACE FUNCTION compute_payroll_suggestion(
  p_employee_id   UUID,
  p_period_from   DATE,
  p_period_to     DATE,
  p_prorate_method TEXT DEFAULT 'work_days'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_emp                 employees%ROWTYPE;
  v_hours               JSONB;
  v_work_days           INTEGER;
  v_total_hours         NUMERIC;
  v_ot_hours            NUMERIC;
  v_calendar_days       INTEGER;
  v_daily_rate          NUMERIC;
  v_hourly_rate         NUMERIC;
  v_base_amount         NUMERIC := 0;
  v_ot_amount           NUMERIC := 0;
  v_full_period_amount  NUMERIC := 0;
BEGIN
  SELECT * INTO v_emp FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', p_employee_id;
  END IF;

  -- Get hours from time logs
  v_hours        := get_employee_hours(p_employee_id, p_period_from, p_period_to);
  v_work_days    := COALESCE((v_hours->>'work_days')::INTEGER,   0);
  v_total_hours  := COALESCE((v_hours->>'total_hours')::NUMERIC, 0);
  v_ot_hours     := COALESCE((v_hours->>'ot_hours')::NUMERIC,    0);
  v_calendar_days := (p_period_to - p_period_from) + 1;

  -- Compute effective rates based on payment_type
  IF v_emp.payment_type = 'daily' THEN
    v_daily_rate  := COALESCE(v_emp.daily_rate,  v_emp.base_salary);
    v_hourly_rate := COALESCE(v_emp.hourly_rate, v_daily_rate / v_emp.standard_hours_per_day);
    v_base_amount := v_work_days * v_daily_rate;
    v_full_period_amount := v_calendar_days * v_daily_rate;

  ELSIF v_emp.payment_type = 'monthly' THEN
    v_daily_rate  := COALESCE(v_emp.daily_rate,
                              v_emp.base_salary::NUMERIC / v_emp.standard_days_per_month);
    v_hourly_rate := COALESCE(v_emp.hourly_rate,
                              v_daily_rate / v_emp.standard_hours_per_day);

    -- Pro-ration strategy
    IF p_prorate_method = 'full' THEN
      v_base_amount := v_emp.base_salary;
    ELSIF p_prorate_method = 'calendar_days' THEN
      -- prorate over 30 days
      v_base_amount := v_emp.base_salary * (LEAST(v_calendar_days, 30)::NUMERIC / 30);
    ELSE
      -- 'work_days': pay per actual work day
      v_base_amount := v_work_days * v_daily_rate;
    END IF;
    v_full_period_amount := v_emp.base_salary;

  ELSIF v_emp.payment_type = 'hourly' THEN
    v_hourly_rate := COALESCE(v_emp.hourly_rate, v_emp.base_salary);
    v_daily_rate  := v_hourly_rate * v_emp.standard_hours_per_day;
    v_base_amount := v_total_hours * v_hourly_rate;
    v_full_period_amount := v_calendar_days * v_daily_rate;
  END IF;

  v_ot_amount := v_ot_hours * v_hourly_rate * v_emp.ot_multiplier;

  RETURN jsonb_build_object(
    'payment_type',        v_emp.payment_type,
    'work_days',           v_work_days,
    'total_hours',         ROUND(v_total_hours, 2),
    'ot_hours',            ROUND(v_ot_hours, 2),
    'calendar_days',       v_calendar_days,
    'daily_rate',          ROUND(v_daily_rate, 2),
    'hourly_rate',         ROUND(v_hourly_rate, 4),
    'base_amount',         ROUND(v_base_amount, 2),
    'ot_amount',           ROUND(v_ot_amount, 2),
    'full_period_amount',  ROUND(v_full_period_amount, 2),
    'day_breakdown',       v_hours->'day_breakdown'
  );
END;
$$;

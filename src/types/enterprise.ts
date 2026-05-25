/**
 * Enterprise types — customers, services, holidays, leaves,
 * materials, ratings, audit log, documents
 */

// ─── CUSTOMERS ────────────────────────────────────────────────
export type CustomerType = 'individual' | 'business'
export type CustomerTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type Customer = {
  id:              string
  org_id:          string
  customer_code:   string
  name:            string
  type:            CustomerType
  contact_name:    string | null
  phone:           string | null
  email:           string | null
  line_id:         string | null
  address:         string | null
  district:        string | null
  province:        string | null
  postcode:        string | null
  lat:             number | null
  lng:             number | null
  tax_id:          string | null
  notes:           string | null
  tags:            string[]
  is_active:       boolean
  total_jobs:      number
  total_revenue:   number
  avg_rating:      number | null
  last_job_at:     string | null
  created_at:      string
  updated_at:      string
}

// ─── SERVICES ─────────────────────────────────────────────────
export type Service = {
  id:               string
  org_id:           string
  code:             string
  name:             string
  description:      string | null
  category:         string | null
  default_price:    number
  unit:             string
  est_duration_min: number | null
  default_priority: 'low' | 'normal' | 'high' | 'urgent'
  required_skills:  string[]
  is_active:        boolean
  use_count:        number
  created_at:       string
  updated_at:       string
}

// ─── HOLIDAYS ─────────────────────────────────────────────────
export type Holiday = {
  id:         string
  org_id:     string
  date:       string  // YYYY-MM-DD
  name:       string
  kind:       'public' | 'company' | 'religious'
  is_paid:    boolean
  notes:      string | null
  created_at: string
}

// ─── LEAVES ───────────────────────────────────────────────────
export type LeaveKind     = 'vacation' | 'sick' | 'personal' | 'maternity' | 'bereavement' | 'unpaid' | 'other'
export type LeaveStatus   = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type LeaveRequest = {
  id:           string
  org_id:       string
  employee_id:  string
  kind:         LeaveKind
  start_date:   string
  end_date:     string
  total_days:   number
  reason:       string
  attachments:  string[]
  status:       LeaveStatus
  reviewed_by:  string | null
  reviewed_at:  string | null
  review_note:  string | null
  created_at:   string
  updated_at:   string
  employee?:    { full_name: string; role: string; avatar_url: string | null } | null
}

// ─── MATERIALS / INVENTORY ───────────────────────────────────
export type Material = {
  id:          string
  org_id:      string
  code:        string
  name:        string
  description: string | null
  category:    string | null
  unit:        string
  unit_cost:   number
  unit_price:  number | null
  stock_qty:   number
  min_stock:   number
  location:    string | null
  is_active:   boolean
  created_at:  string
  updated_at:  string
}

export type MaterialMovement = {
  id:             string
  org_id:         string
  material_id:    string
  kind:           'in' | 'out' | 'adjustment' | 'job_consume'
  quantity:       number
  unit_cost:      number | null
  reference_id:   string | null
  reference_kind: string | null
  note:           string | null
  performed_by:   string
  created_at:     string
}

export type JobMaterial = {
  id:          string
  org_id:      string
  job_id:      string
  material_id: string
  quantity:    number
  unit_cost:   number
  total_cost:  number
  note:        string | null
  created_at:  string
  material?:   { name: string; code: string; unit: string } | null
}

// ─── RATINGS ──────────────────────────────────────────────────
export type Rating = {
  id:              string
  org_id:          string
  job_id:          string
  customer_id:     string | null
  employee_id:     string | null
  overall:         number  // 1-5
  quality:         number | null
  punctuality:     number | null
  professionalism: number | null
  cleanliness:     number | null
  comment:         string | null
  recommended:     boolean | null
  created_at:      string
  employee?:       { full_name: string; role: string } | null
  customer?:       { name: string } | null
}

// ─── AUDIT LOG ────────────────────────────────────────────────
export type AuditAction = 'create' | 'update' | 'delete' | 'approve' | 'reject' | 'pay' | 'assign' | 'login'
export type AuditEntity = 'employee' | 'job' | 'payroll' | 'time_log' | 'customer' | 'service' | 'leave' | 'material'

export type AuditLog = {
  id:           string
  org_id:       string
  actor_id:     string | null
  actor_name:   string | null
  action:       AuditAction
  entity_kind:  AuditEntity
  entity_id:    string | null
  entity_label: string | null
  changes:      Record<string, { old: any; new: any }>
  ip_address:   string | null
  user_agent:   string | null
  created_at:   string
}

// ─── DOCUMENTS ────────────────────────────────────────────────
export type Document = {
  id:          string
  org_id:      string
  owner_kind:  'employee' | 'job' | 'customer' | 'org'
  owner_id:    string
  name:        string
  file_url:    string
  file_size:   number | null
  mime_type:   string | null
  category:    string | null
  uploaded_by: string
  created_at:  string
}

// ─── ANALYTICS ────────────────────────────────────────────────
export type EmployeePerformance = {
  id:                   string
  org_id:               string
  full_name:            string
  role:                 string
  total_jobs_done:      number
  total_jobs_rejected:  number
  avg_rating:           number | null
  total_revenue_earned: number
  success_rate_pct:     number | null
  active_jobs:          number
  jobs_last_30d:        number
}

export type MonthlyRevenue = {
  org_id:         string
  month:          string  // YYYY-MM
  jobs_count:     number
  revenue:        number
  materials_cost: number
  labor_cost:     number
  profit:         number
  avg_job_value:  number
}

export type CustomerLTV = Customer & { tier: CustomerTier }

// ─── ORG SETTINGS ─────────────────────────────────────────────
export type OrgSettings = {
  id:                 string
  name:               string
  slug:               string
  logo_url:           string | null
  phone:              string | null
  email:              string | null
  address:            string | null
  tax_id:             string | null
  website:            string | null
  work_start_time:    string  // HH:MM
  work_end_time:      string
  break_minutes:      number
  workweek:           string[]
  holiday_ot_rate:    number
  holiday_pay_rate:   number
  currency:           string
  timezone:           string
}

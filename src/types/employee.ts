/**
 * Extended employee types (v4)
 */

export type PaymentType    = 'daily' | 'monthly' | 'hourly'
export type EmploymentType = 'fulltime' | 'parttime' | 'contract' | 'daily' | 'probation'
export type PositionLevel  = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'foreman' | 'manager' | 'general'
export type Gender         = 'male' | 'female' | 'other'
export type MaritalStatus  = 'single' | 'married' | 'divorced' | 'widowed'
export type ProrateMethod  = 'full' | 'work_days' | 'calendar_days' | 'manual'

export type Certification = {
  name:        string
  issuer?:     string
  number?:     string
  issued_at?:  string  // YYYY-MM-DD
  expires_at?: string
}

export type LicenseNumber = {
  type:        string  // 'ใบขับขี่', 'ใบช่างไฟ', etc.
  number:      string
  expires_at?: string
}

export type EmployeeExtended = {
  // Core (existing)
  id:                string
  org_id:            string
  employee_code:     string
  full_name:         string
  nickname:          string | null
  avatar_url:        string | null
  role:              string
  status:            'active' | 'leave' | 'off' | 'resigned'

  // Payment & employment
  payment_type:            PaymentType
  employment_type:         EmploymentType
  position_level:          PositionLevel | null
  department:              string | null
  probation_end_date:      string | null
  standard_days_per_month: number  // 26
  standard_hours_per_day:  number  // 8

  // Rates
  base_salary:    number
  daily_rate:     number | null
  hourly_rate:    number | null
  ot_multiplier:  number
  sso_rate:       number
  tax_rate:       number

  // Personal
  national_id:        string | null
  birth_date:         string | null
  gender:             Gender | null
  nationality:        string | null
  marital_status:     MaritalStatus | null
  religion:           string | null
  phone:              string | null
  email:              string | null
  line_user_id:       string | null
  address:            string | null
  registered_address: string | null

  // Emergency
  emergency_contact_name:     string | null
  emergency_contact_phone:    string | null
  emergency_contact_relation: string | null

  // Gov IDs
  social_security_number: string | null
  tax_id:                 string | null

  // Bank
  bank_name:         string | null
  bank_account:      string | null
  bank_account_name: string | null

  // Skills
  skills:          string[]
  certifications:  Certification[]
  license_numbers: LicenseNumber[]

  // Benefits
  has_health_insurance:     boolean
  has_life_insurance:       boolean
  vacation_days_per_year:   number
  sick_days_per_year:       number
  personal_days_per_year:   number

  // Misc
  start_date: string | null
  end_date:   string | null
  notes:      string | null

  created_at: string
  updated_at: string
}

// ─── Payroll computation result from the DB function ─────────
export type PayrollSuggestion = {
  payment_type:        PaymentType
  work_days:           number
  total_hours:         number
  ot_hours:            number
  calendar_days:       number
  daily_rate:          number    // effective rate used
  hourly_rate:         number
  base_amount:         number    // suggested base
  ot_amount:           number    // suggested OT
  full_period_amount:  number    // what full month/period would pay
  day_breakdown:       any[]
}

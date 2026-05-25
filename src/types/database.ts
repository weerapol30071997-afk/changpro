// Auto-generated from Supabase schema — run `npm run db:types` to regenerate
// DO NOT edit manually

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      profiles: {
        Row: {
          id: string          // references auth.users.id
          org_id: string
          full_name: string
          avatar_url: string | null
          role: 'admin' | 'manager' | 'employee'
          employee_id: string | null  // links to employees.id
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          full_name: string
          avatar_url?: string | null
          role?: 'admin' | 'manager' | 'employee'
          employee_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      employees: {
        Row: {
          id: string
          org_id: string
          employee_code: string
          full_name: string
          nickname: string | null
          avatar_url: string | null
          role: string
          phone: string | null
          email: string | null
          line_user_id: string | null
          address: string | null
          start_date: string | null
          end_date: string | null
          status: 'active' | 'leave' | 'off' | 'resigned'
          bank_name: string | null
          bank_account: string | null
          bank_account_name: string | null
          base_salary: number
          daily_rate: number | null     // null = auto (base_salary / 26)
          hourly_rate: number | null    // null = auto
          ot_multiplier: number
          sso_rate: number              // % e.g. 5
          tax_rate: number              // % e.g. 0 (withholding)
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id'|'created_at'|'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      time_logs: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          clock_in: string             // ISO timestamp
          clock_out: string | null
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          clock_in_photo_url: string | null
          clock_out_photo_url: string | null
          note: string | null
          approved_by: string | null   // profile id
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['time_logs']['Row'], 'id'|'created_at'|'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['time_logs']['Insert']>
      }
      jobs: {
        Row: {
          id: string
          org_id: string
          job_code: string
          title: string
          description: string | null
          assigned_to: string | null   // employee id
          created_by: string           // profile id
          status: 'pending' | 'inprogress' | 'done' | 'cancelled'
          priority: 'low' | 'normal' | 'high' | 'urgent'
          location: string | null
          scheduled_at: string | null
          completed_at: string | null
          images: string[]             // array of storage URLs
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id'|'created_at'|'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }
      payroll_periods: {
        Row: {
          id: string
          org_id: string
          employee_id: string
          period_from: string          // date YYYY-MM-DD
          period_to: string
          pay_date: string
          pay_method: 'bank' | 'cash' | 'promptpay'
          work_days: number
          total_hours: number
          ot_hours: number
          base_amount: number
          ot_amount: number
          gross_amount: number
          sso_amount: number
          tax_amount: number
          net_amount: number
          sso_rate: number
          tax_rate: number
          ot_multiplier: number
          allowances: Json             // {type, amount, note}[]
          deductions: Json             // {type, amount, note}[]
          day_breakdown: Json          // {date, std_hrs, ot_hrs}[]
          note: string | null
          status: 'draft' | 'approved' | 'paid'
          approved_by: string | null
          approved_at: string | null
          paid_by: string | null
          paid_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['payroll_periods']['Row'], 'id'|'created_at'|'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['payroll_periods']['Insert']>
      }
    }
    Views: {
      payroll_summary: {
        Row: {
          org_id: string
          month: string
          total_employees: number
          total_gross: number
          total_net: number
          total_paid: number
          count_paid: number
          count_pending: number
        }
      }
    }
    Functions: {
      get_employee_hours: {
        Args: { p_employee_id: string; p_from: string; p_to: string }
        Returns: {
          work_days: number
          total_hours: number
          ot_hours: number
          day_breakdown: Json
        }
      }
    }
  }
}

// ─── Convenience aliases ─────────────────────────────────────────────────────
export type Org            = Database['public']['Tables']['organizations']['Row']
export type Profile        = Database['public']['Tables']['profiles']['Row']
export type Employee       = Database['public']['Tables']['employees']['Row']
export type TimeLog        = Database['public']['Tables']['time_logs']['Row']
export type Job            = Database['public']['Tables']['jobs']['Row']
export type PayrollPeriod  = Database['public']['Tables']['payroll_periods']['Row']
export type PayrollSummary = Database['public']['Views']['payroll_summary']['Row']

export type EmployeeStatus = Employee['status']
export type JobStatus      = Job['status']
export type JobPriority    = Job['priority']
export type PayrollStatus  = PayrollPeriod['status']
export type UserRole       = Profile['role']

export type AllowanceItem  = { id: string; type: string; amount: number; note: string }
export type DeductionItem  = { id: string; type: string; amount: number; note: string }
export type DayBreakdown   = { date: string; std_hrs: number; ot_hrs: number; clock_in?: string; clock_out?: string }

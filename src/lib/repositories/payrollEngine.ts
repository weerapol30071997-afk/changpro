/**
 * Payroll Computation Engine (v4)
 * Handles daily / monthly / hourly payment types with proper proration.
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/database'
import { type EmployeeExtended, type PayrollSuggestion, type ProrateMethod } from '@/types/employee'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

// โ”€โ”€โ”€ Constants โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export const SSO_CEILING        = 15_000   // เธเธฒเธ—
export const SSO_FLOOR          = 1_650    // เธเธฒเธ— (เธเธฒเธเธเธฑเนเธเธ•เนเธณ)
export const DEFAULT_WORK_HRS   = 8
export const DEFAULT_WORK_DAYS  = 26

// โ”€โ”€โ”€ Compute effective rates per employee โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export function computeEffectiveRates(employee: EmployeeExtended) {
  const stdDays = employee.standard_days_per_month || DEFAULT_WORK_DAYS
  const stdHrs  = employee.standard_hours_per_day  || DEFAULT_WORK_HRS

  let daily: number, hourly: number

  switch (employee.payment_type) {
    case 'daily':
      daily  = employee.daily_rate  ?? employee.base_salary
      hourly = employee.hourly_rate ?? (daily / stdHrs)
      break

    case 'hourly':
      hourly = employee.hourly_rate ?? employee.base_salary
      daily  = hourly * stdHrs
      break

    case 'monthly':
    default:
      daily  = employee.daily_rate  ?? (employee.base_salary / stdDays)
      hourly = employee.hourly_rate ?? (daily / stdHrs)
      break
  }

  return { daily, hourly, ot_multiplier: employee.ot_multiplier }
}

// โ”€โ”€โ”€ Compute suggested base amount by payment_type โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export function computeSuggestedBase(
  employee:       EmployeeExtended,
  hours:          { work_days: number; total_hours: number; ot_hours: number },
  calendar_days:  number,
  prorate_method: ProrateMethod = 'work_days'
): { base_amount: number; ot_amount: number; daily_rate_used: number; hourly_rate_used: number } {

  const { daily, hourly, ot_multiplier } = computeEffectiveRates(employee)

  let base_amount = 0
  switch (employee.payment_type) {
    case 'daily':
      base_amount = hours.work_days * daily
      break

    case 'hourly':
      base_amount = hours.total_hours * hourly
      break

    case 'monthly':
      if (prorate_method === 'full') {
        base_amount = employee.base_salary
      } else if (prorate_method === 'calendar_days') {
        base_amount = employee.base_salary * (Math.min(calendar_days, 30) / 30)
      } else if (prorate_method === 'manual') {
        base_amount = 0  // admin will enter
      } else {
        // work_days
        base_amount = hours.work_days * daily
      }
      break
  }

  const ot_amount = hours.ot_hours * hourly * ot_multiplier

  return {
    base_amount:     Math.round(base_amount),
    ot_amount:       Math.round(ot_amount),
    daily_rate_used: daily,
    hourly_rate_used: hourly,
  }
}

// โ”€โ”€โ”€ Final totals computation (pure) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export function computePayrollTotals(input: {
  base_amount: number
  ot_amount:   number
  allowances:  { amount: number }[]
  deductions:  { amount: number }[]
  sso_rate:    number
  tax_rate:    number
}) {
  const totAllow   = input.allowances.reduce((s,a) => s + Number(a.amount||0), 0)
  const totDeduct  = input.deductions.reduce((s,d) => s + Number(d.amount||0), 0)
  const gross      = Number(input.base_amount) + Number(input.ot_amount) + totAllow

  // SSO เธเธฒเธ 1,650 - 15,000
  const ssoBase    = Math.max(SSO_FLOOR, Math.min(gross, SSO_CEILING))
  const sso        = Math.round(ssoBase * (Number(input.sso_rate)/100))
  const tax        = Math.round(gross  * (Number(input.tax_rate)/100))
  const net        = gross - sso - tax - totDeduct

  return {
    allowance_total: totAllow,
    deduction_total: totDeduct,
    gross_amount:    gross,
    sso_base:        ssoBase,
    sso_amount:      sso,
    tax_amount:      tax,
    net_amount:      net,
  }
}

// โ”€โ”€โ”€ Fetch suggestion from DB (preferred โ€” uses time logs) โ”€โ”€โ”€โ”€
export async function fetchPayrollSuggestion(
  db: DB,
  employee_id:    string,
  period_from:    string,
  period_to:      string,
  prorate_method: ProrateMethod = 'work_days'
): Promise<PayrollSuggestion> {
  const { data, error } = await (db as any).rpc('compute_payroll_suggestion', {
    p_employee_id:    employee_id,
    p_period_from:    period_from,
    p_period_to:      period_to,
    p_prorate_method: prorate_method,
  })
  if (error) throw new AppError('COMPUTE_FAILED', error.message)
  return data as PayrollSuggestion
}

// โ”€โ”€โ”€ Re-export DB CRUD from old payroll repo โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
export {
  listPayrollByOrg,
  listPayrollByEmployee,
  getPayrollPeriod,
  createPayroll,
  updatePayroll,
  approvePayroll,
  deletePayroll,
} from './payroll'


export async function markPayrollPaid(db: any, id: string, paid_by: string) {
  const { data, error } = await db.from('payroll_periods')
    .update({ status: 'paid', paid_by, paid_at: new Date().toISOString() })
    .eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function getPayrollSummary(db: any, org_id: string) {
  const { data, error } = await db.from('payroll_periods')
    .select('status, net_amount').eq('org_id', org_id)
  if (error) throw error
  return data ?? []
}

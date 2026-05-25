/**
 * Payroll Repository + Computation Engine — v3
 * - Supports monthly / daily / hourly / piecework
 * - Range-based calculation with holiday premium pay
 * - Advance deduction integration
 * - Partial payment tracking
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database, type Employee, type PayrollPeriod, type AllowanceItem, type DeductionItem } from '@/types/database'
import { type PayrollBreakdown, type PayType, type DayBreakdownV3 } from '@/types/compensation'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

// ─── Constants ────────────────────────────────────────────────
const SSO_CEILING = 15_000

// ─── Effective rates (snapshot at payroll creation) ──────────
export function computeEffectiveRates(employee: Employee & any) {
  const days_per_month = employee.standard_days_per_month ?? 26
  const hrs_per_day    = employee.standard_hours_per_day  ?? 8
  const daily          = employee.daily_rate  ?? (employee.base_salary / days_per_month)
  const hourly         = employee.hourly_rate ?? (employee.base_salary / (days_per_month * hrs_per_day))
  return {
    daily, hourly,
    ot_multiplier:       employee.ot_multiplier      ?? 1.5,
    holiday_rate:        employee.holiday_rate       ?? 2,
    holiday_ot_rate:     employee.holiday_ot_rate    ?? 3,
    days_per_month,
    hrs_per_day,
  }
}

// ─── Compute base/OT/holiday amounts from hours ──────────────
export type CompensationInput = {
  employee:        Employee & any
  pay_type:        PayType
  work_days:       number
  total_hours:     number    // regular hours
  ot_hours:        number
  holiday_days:    number
  holiday_hours:   number
  holiday_ot_hours: number
  absent_days:     number
  leave_unpaid:    number    // days
  period_from:     string    // YYYY-MM-DD
  period_to:       string
}

export function computeCompensation(input: CompensationInput) {
  const rates = computeEffectiveRates(input.employee)
  const { daily, hourly, ot_multiplier, holiday_rate, holiday_ot_rate, days_per_month, hrs_per_day } = rates

  let base_amount = 0

  if (input.pay_type === 'monthly') {
    // Monthly salary — prorate by actual days in period
    const totalDays = daysBetween(input.period_from, input.period_to) + 1
    const month_salary = input.employee.base_salary
    // Subtract unpaid leave + absent days
    const paid_days = totalDays - input.absent_days - input.leave_unpaid
    base_amount = Math.round((month_salary / totalDays) * paid_days)
  } else if (input.pay_type === 'daily') {
    base_amount = Math.round(daily * input.work_days)
  } else if (input.pay_type === 'hourly') {
    base_amount = Math.round(hourly * input.total_hours)
  } else {
    // piecework — base = 0, all comp via allowances
    base_amount = 0
  }

  const ot_amount          = Math.round(input.ot_hours * hourly * ot_multiplier)
  const holiday_amount     = Math.round(input.holiday_hours    * hourly * holiday_rate)
  const holiday_ot_amount  = Math.round(input.holiday_ot_hours * hourly * holiday_ot_rate)

  return {
    base_amount,
    ot_amount,
    holiday_amount,
    holiday_ot_amount,
    rates_snapshot: {
      daily_rate:    daily,
      hourly_rate:   hourly,
      base_salary:   input.employee.base_salary,
      ot_multiplier,
      holiday_rate,
      holiday_ot_rate,
    },
  }
}

// ─── Final totals (gross / sso / tax / net) ──────────────────
export function computePayrollTotals(args: {
  base_amount:       number
  ot_amount:         number
  holiday_amount:    number
  holiday_ot_amount: number
  allowances:        AllowanceItem[]
  deductions:        DeductionItem[]
  advance_deduction: number
  sso_rate:          number
  tax_rate:          number
}) {
  const allowance_total = args.allowances.reduce((s, a) => s + Number(a.amount), 0)
  const deduction_total = args.deductions.reduce((s, d) => s + Number(d.amount), 0)

  const gross_amount = args.base_amount
    + args.ot_amount
    + args.holiday_amount
    + args.holiday_ot_amount
    + allowance_total

  const sso_base   = Math.min(gross_amount, SSO_CEILING)
  const sso_amount = Math.round(sso_base * (Number(args.sso_rate) / 100))
  const tax_amount = Math.round(gross_amount * (Number(args.tax_rate) / 100))

  const net_amount = gross_amount - sso_amount - tax_amount - deduction_total - Number(args.advance_deduction || 0)

  return {
    allowance_total,
    deduction_total,
    gross_amount,
    sso_base,
    sso_amount,
    tax_amount,
    net_amount,
  }
}

// ─── DB calls ────────────────────────────────────────────────
export async function fetchPayrollBreakdown(
  db: DB,
  employee_id: string,
  period_from: string,
  period_to:   string
): Promise<PayrollBreakdown> {
  const { data, error } = await db.rpc('compute_payroll_breakdown' as any, {
    p_employee_id: employee_id,
    p_from:        period_from,
    p_to:          period_to,
  })
  if (error) throw new AppError('FETCH_BREAKDOWN_FAILED', error.message)
  return data as PayrollBreakdown
}

// ─── List & get ───────────────────────────────────────────────
export async function listPayrollByOrg(
  db: DB,
  org_id: string,
  options: { month?: string; from?: string; to?: string; status?: string } = {}
) {
  let query = db
    .from('payroll_periods')
    .select(`
      *,
      employee:employees (
        id, full_name, role, avatar_url, bank_name, bank_account,
        pay_type, base_salary, ot_multiplier
      ),
      payment_summary:payroll_payment_summary!inner (
        total_paid, balance, payment_count, last_payment_at
      )
    `)
    .eq('org_id', org_id)
    .order('period_from', { ascending: false })

  if (options.month) {
    const [y, m] = options.month.split('-').map(Number)
    const from = new Date(y, m - 1, 1).toISOString().split('T')[0]
    const to   = new Date(y, m, 0).toISOString().split('T')[0]
    query = query.gte('period_from', from).lte('period_from', to)
  }
  if (options.from)   query = query.gte('period_from', options.from)
  if (options.to)     query = query.lte('period_to',   options.to)
  if (options.status) query = query.eq('status', options.status)

  const { data, error } = await query
  if (error) throw new AppError('FETCH_PAYROLL_FAILED', error.message)
  return data as any[]
}

export async function listPayrollByEmployee(db: DB, employee_id: string): Promise<PayrollPeriod[]> {
  const { data, error } = await db
    .from('payroll_periods')
    .select('*')
    .eq('employee_id', employee_id)
    .order('period_from', { ascending: false })
  if (error) throw new AppError('FETCH_PAYROLL_FAILED', error.message)
  return data
}

export async function getPayrollPeriod(db: DB, id: string): Promise<PayrollPeriod> {
  const { data, error } = await db
    .from('payroll_periods')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw new AppError('PAYROLL_NOT_FOUND', error.message, 404)
  return data
}

// ─── Create / update ──────────────────────────────────────────
export type CreatePayrollInput = Omit<PayrollPeriod,
  'id' | 'org_id' | 'created_at' | 'updated_at' | 'approved_by' | 'approved_at' | 'paid_by' | 'paid_at'>

export async function createPayroll(
  db: DB,
  org_id: string,
  input: CreatePayrollInput
): Promise<PayrollPeriod> {
  const { data, error } = await (db as any)
    .from('payroll_periods')
    .insert({ ...input, org_id })
    .select().single()
  if (error) throw new AppError('CREATE_PAYROLL_FAILED', error.message)
  return data
}

export async function updatePayroll(
  db: DB,
  id: string,
  input: Partial<CreatePayrollInput>
): Promise<PayrollPeriod> {
  const existing = await getPayrollPeriod(db, id)
  if (existing.status === 'paid')
    throw new AppError('PAYROLL_LOCKED', 'สลิปที่จ่ายแล้วไม่สามารถแก้ไขได้', 403)

  const { data, error } = await (db as any)
    .from('payroll_periods')
    .update(input)
    .eq('id', id)
    .select().single()
  if (error) throw new AppError('UPDATE_PAYROLL_FAILED', error.message)
  return data
}

export async function approvePayroll(db: DB, id: string, approved_by: string): Promise<PayrollPeriod> {
  const existing = await getPayrollPeriod(db, id)
  if (existing.status !== 'draft')
    throw new AppError('INVALID_STATUS', 'อนุมัติได้เฉพาะแบบร่างเท่านั้น', 400)

  const { data, error } = await (db as any)
    .from('payroll_periods')
    .update({ status: 'approved', approved_by, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select().single()
  if (error) throw new AppError('APPROVE_PAYROLL_FAILED', error.message)
  return data
}

export async function deletePayroll(db: DB, id: string): Promise<void> {
  const existing = await getPayrollPeriod(db, id)
  if (existing.status === 'paid')
    throw new AppError('PAYROLL_LOCKED', 'ไม่สามารถลบสลิปที่จ่ายแล้ว', 403)
  const { error } = await db.from('payroll_periods').delete().eq('id', id)
  if (error) throw new AppError('DELETE_PAYROLL_FAILED', error.message)
}

// ─── Helpers ──────────────────────────────────────────────────
function daysBetween(from: string, to: string): number {
  return Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

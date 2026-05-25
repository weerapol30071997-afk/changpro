/**
 * POST /api/payroll/compute-hours
 * Returns hours + suggested amounts based on employee's payment_type.
 * The DB function does the heavy lifting (handles daily/monthly/hourly correctly).
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireRole } from '@/lib/errors'
import { fetchPayrollSuggestion } from '@/lib/repositories/payrollEngine'
import { getEmployee } from '@/lib/repositories/employees'

const Schema = z.object({
  employee_id:    z.string().uuid(),
  period_from:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prorate_method: z.enum(['full','work_days','calendar_days','manual']).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { db } = await requireRole('admin', 'manager')
    const body   = Schema.parse(await req.json())

    const [suggestion, employee] = await Promise.all([
      fetchPayrollSuggestion(
        db,
        body.employee_id,
        body.period_from,
        body.period_to,
        body.prorate_method ?? 'work_days'
      ),
      getEmployee(db, body.employee_id),
    ])

    return ok({
      ...suggestion,
      employee: {
        id:              employee.id,
        full_name:       employee.full_name,
        role:            employee.role,
        payment_type:    (employee as any).payment_type,
        base_salary:     employee.base_salary,
        daily_rate:      employee.daily_rate,
        hourly_rate:     employee.hourly_rate,
        ot_multiplier:   employee.ot_multiplier,
        sso_rate:        employee.sso_rate,
        tax_rate:        employee.tax_rate,
        bank_name:       employee.bank_name,
        bank_account:    employee.bank_account,
        standard_days_per_month: (employee as any).standard_days_per_month ?? 26,
        standard_hours_per_day:  (employee as any).standard_hours_per_day  ?? 8,
      },
    })
  } catch (e) { return err(e) }
}

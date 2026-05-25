/**
 * POST /api/payroll          — create payroll period
 * GET  /api/payroll?month=   — list by org + month
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireRole } from '@/lib/errors'
import {
  createPayroll,
  listPayrollByOrg,
  getPayrollSummary,
} from '@/lib/repositories/payroll'

const CreateSchema = z.object({
  employee_id:   z.string().uuid(),
  period_from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pay_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pay_method:    z.enum(['bank','cash','promptpay']),
  work_days:     z.number().int().min(0),
  total_hours:   z.number().min(0),
  ot_hours:      z.number().min(0),
  base_amount:   z.number().min(0),
  ot_amount:     z.number().min(0),
  gross_amount:  z.number().min(0),
  sso_amount:    z.number().min(0),
  tax_amount:    z.number().min(0),
  net_amount:    z.number(),
  sso_rate:      z.number().min(0).max(10),
  tax_rate:      z.number().min(0).max(30),
  ot_multiplier: z.number().min(1).max(5),
  allowances:    z.array(z.object({ id:z.string(), type:z.string(), amount:z.number(), note:z.string() })),
  deductions:    z.array(z.object({ id:z.string(), type:z.string(), amount:z.number(), note:z.string() })),
  day_breakdown: z.array(z.any()),
  note:          z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const month = req.nextUrl.searchParams.get('month') ?? undefined

    const [periods, summary] = await Promise.all([
      listPayrollByOrg(db, profile.org_id, month),
      month ? getPayrollSummary(db, profile.org_id, month) : null,
    ])

    return ok({ periods, summary })
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const body = await req.json()
    const input = CreateSchema.parse(body)

    const period = await createPayroll(db, profile.org_id, {
      ...input,
      created_by: profile.id,
    })

    return created(period)
  } catch (e) { return err(e) }
}

/**
 * GET    /api/payroll/[id]           — get single payroll
 * PUT    /api/payroll/[id]           — update draft
 * DELETE /api/payroll/[id]           — delete draft
 * POST   /api/payroll/[id]/approve   — approve
 * POST   /api/payroll/[id]/pay       — mark paid
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireRole } from '@/lib/errors'
import {
  getPayrollPeriod,
  updatePayroll,
  deletePayroll,
  approvePayroll,
  markPayrollPaid,
} from '@/lib/repositories/payroll'

type Ctx = { params: { id: string } }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin', 'manager', 'employee')
    return ok(await getPayrollPeriod(db, params.id))
  } catch (e) { return err(e) }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const body = await req.json()
    return ok(await updatePayroll(db, params.id, { ...body, created_by: profile.id }))
  } catch (e) { return err(e) }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin', 'manager')
    await deletePayroll(db, params.id)
    return ok({ deleted: true })
  } catch (e) { return err(e) }
}

// ─── /api/payroll/[id]/approve ───────────────────────────────
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()   // 'approve' | 'pay'

    if (action === 'approve') {
      return ok(await approvePayroll(db, params.id, profile.id))
    }
    if (action === 'pay') {
      return ok(await markPayrollPaid(db, params.id, profile.id))
    }

    return err(new Error('Unknown action'))
  } catch (e) { return err(e) }
}

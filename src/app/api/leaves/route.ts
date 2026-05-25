import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole, AppError } from '@/lib/errors'
import { Leaves } from '@/lib/repositories/enterprise'

const CreateSchema = z.object({
  kind:        z.enum(['vacation','sick','personal','maternity','bereavement','unpaid','other']),
  start_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:      z.string().min(1).max(2000),
  attachments: z.array(z.string().url()).default([]),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const sp = req.nextUrl.searchParams
    const employee_id = profile.role === 'employee' ? profile.employee_id! : sp.get('employee_id') ?? undefined
    return ok(await Leaves.list(db, profile.org_id, {
      employee_id, status: sp.get('status') ?? undefined,
    }))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    if (!profile.employee_id)
      throw new AppError('NO_EMPLOYEE', 'บัญชีของคุณยังไม่ได้ผูกกับข้อมูลพนักงาน', 400)
    const body = CreateSchema.parse(await req.json())
    return created(await Leaves.create(db, profile.org_id, profile.employee_id, body as any))
  } catch (e) { return err(e) }
}

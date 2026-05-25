import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, requireRole } from '@/lib/errors'
import { getEmployee, updateEmployee, softDeleteEmployee } from '@/lib/repositories/employees'

type Ctx = { params: { id: string } }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireAuth()
    return ok(await getEmployee(db, params.id))
  } catch (e) { return err(e) }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin', 'manager')
    const body = await req.json()
    return ok(await updateEmployee(db, params.id, body))
  } catch (e) { return err(e) }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin', 'manager')
    await softDeleteEmployee(db, params.id)
    return ok({ deleted: true })
  } catch (e) { return err(e) }
}

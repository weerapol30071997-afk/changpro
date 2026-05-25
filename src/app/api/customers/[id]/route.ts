import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, requireRole } from '@/lib/errors'
import { Customers } from '@/lib/repositories/enterprise'

type Ctx = { params: { id: string } }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireAuth()
    return ok(await Customers.get(db, params.id))
  } catch (e) { return err(e) }
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin','manager')
    return ok(await Customers.update(db, params.id, await req.json()))
  } catch (e) { return err(e) }
}
export async function DELETE(_: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin','manager')
    await Customers.softDelete(db, params.id)
    return ok({ deleted: true })
  } catch (e) { return err(e) }
}

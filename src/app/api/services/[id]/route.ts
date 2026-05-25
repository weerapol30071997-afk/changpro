import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, requireRole } from '@/lib/errors'
import { Services } from '@/lib/repositories/enterprise'

type Ctx = { params: { id: string } }
export async function GET(_: NextRequest, { params }: Ctx) {
  try { const { db } = await requireAuth(); return ok(await Services.get(db, params.id)) }
  catch (e) { return err(e) }
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const { db } = await requireRole('admin','manager')
    return ok(await Services.update(db, params.id, await req.json()))
  } catch (e) { return err(e) }
}

import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, requireRole } from '@/lib/errors'
import { Org } from '@/lib/repositories/enterprise'

export async function GET() {
  try {
    const { profile, db } = await requireAuth()
    return ok(await Org.get(db, profile.org_id))
  } catch (e) { return err(e) }
}

export async function PUT(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin')
    const body = await req.json()
    return ok(await Org.update(db, profile.org_id, body))
  } catch (e) { return err(e) }
}

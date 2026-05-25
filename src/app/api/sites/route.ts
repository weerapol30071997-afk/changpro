import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { listSites, createSite } from '@/lib/repositories/workSites'

const CreateSchema = z.object({
  name:     z.string().min(1).max(120),
  address:  z.string().max(500).optional(),
  lat:      z.number().min(-90).max(90),
  lng:      z.number().min(-180).max(180),
  radius_m: z.number().int().min(20).max(5000),
})

export async function GET() {
  try {
    const { profile, db } = await requireAuth()
    return ok(await listSites(db, profile.org_id))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin', 'manager')
    const body  = CreateSchema.parse(await req.json())
    const site  = await createSite(db, profile.org_id, profile.id, body)
    return created(site)
  } catch (e) { return err(e) }
}

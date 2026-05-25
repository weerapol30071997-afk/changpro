import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { Services } from '@/lib/repositories/enterprise'

const Schema = z.object({
  code:             z.string().max(30).optional(),
  name:             z.string().min(1).max(120),
  description:      z.string().max(2000).optional(),
  category:         z.string().max(60).optional(),
  default_price:    z.coerce.number().min(0).default(0),
  unit:             z.string().max(20).default('งาน'),
  est_duration_min: z.coerce.number().int().min(0).optional(),
  default_priority: z.enum(['low','normal','high','urgent']).default('normal'),
  required_skills:  z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const { profile, db } = await requireAuth()
    return ok(await Services.list(db, profile.org_id))
  } catch (e) { return err(e) }
}
export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return created(await Services.create(db, profile.org_id, body as any))
  } catch (e) { return err(e) }
}

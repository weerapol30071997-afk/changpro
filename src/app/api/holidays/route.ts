/**
 * Holidays API
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { Holidays } from '@/lib/repositories/enterprise'

const Schema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name:    z.string().min(1).max(120),
  kind:    z.enum(['public','company','religious']).default('public'),
  is_paid: z.boolean().default(true),
  notes:   z.string().max(500).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const yr = req.nextUrl.searchParams.get('year')
    return ok(await Holidays.list(db, profile.org_id, yr ? Number(yr) : undefined))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return created(await Holidays.create(db, profile.org_id, body as any))
  } catch (e) { return err(e) }
}

/**
 * GET    /api/customers       — list / search
 * POST   /api/customers       — create
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { Customers } from '@/lib/repositories/enterprise'

const CreateSchema = z.object({
  name:         z.string().min(1).max(120),
  type:         z.enum(['individual','business']).default('individual'),
  contact_name: z.string().max(120).optional(),
  phone:        z.string().max(30).optional(),
  email:        z.string().email().optional().or(z.literal('')),
  line_id:      z.string().max(60).optional(),
  address:      z.string().max(500).optional(),
  district:     z.string().max(80).optional(),
  province:     z.string().max(80).optional(),
  postcode:     z.string().max(10).optional(),
  lat:          z.coerce.number().optional(),
  lng:          z.coerce.number().optional(),
  tax_id:       z.string().max(30).optional(),
  notes:        z.string().max(2000).optional(),
  tags:         z.array(z.string()).default([]),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const search = req.nextUrl.searchParams.get('search') ?? undefined
    return ok(await Customers.list(db, profile.org_id, search))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = CreateSchema.parse(await req.json())
    return created(await Customers.create(db, profile.org_id, profile.id, body as any))
  } catch (e) { return err(e) }
}

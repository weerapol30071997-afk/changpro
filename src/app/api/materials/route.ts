import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { Materials } from '@/lib/repositories/enterprise'

const Schema = z.object({
  code:        z.string().max(30).optional(),
  name:        z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category:    z.string().max(60).optional(),
  unit:        z.string().max(20).default('ชิ้น'),
  unit_cost:   z.coerce.number().min(0).default(0),
  unit_price:  z.coerce.number().min(0).optional(),
  stock_qty:   z.coerce.number().default(0),
  min_stock:   z.coerce.number().min(0).default(0),
  location:    z.string().max(120).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const sp = req.nextUrl.searchParams
    return ok(await Materials.list(db, profile.org_id, {
      low_stock_only: sp.get('low_stock') === '1',
      search:         sp.get('search') ?? undefined,
    }))
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return created(await Materials.create(db, profile.org_id, body as any))
  } catch (e) { return err(e) }
}

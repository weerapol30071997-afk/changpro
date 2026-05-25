import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireRole } from '@/lib/errors'
import { Materials } from '@/lib/repositories/enterprise'

const Schema = z.object({
  material_id: z.string().uuid(),
  kind:        z.enum(['in','out','adjustment','job_consume']),
  quantity:    z.coerce.number().positive(),
  unit_cost:   z.coerce.number().min(0).optional(),
  reference_id:   z.string().uuid().optional(),
  reference_kind: z.string().max(40).optional(),
  note:        z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return created(await Materials.addMovement(db, profile.org_id, profile.id, body as any))
  } catch (e) { return err(e) }
}

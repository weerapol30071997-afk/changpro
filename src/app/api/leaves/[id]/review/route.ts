import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireRole } from '@/lib/errors'
import { Leaves } from '@/lib/repositories/enterprise'

const Schema = z.object({
  status: z.enum(['approved','rejected']),
  note:   z.string().max(2000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return ok(await Leaves.review(db, params.id, body.status, profile.id, body.note))
  } catch (e) { return err(e) }
}

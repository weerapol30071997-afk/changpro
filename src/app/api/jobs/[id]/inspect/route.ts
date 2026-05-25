/**
 * POST /api/jobs/[id]/inspect
 * Body: { result: 'approved' | 'rejected', note?: string }
 *
 * Admin/manager reviews submitted work — approves or rejects with reason.
 * If rejected: 'note' is required and 'rejection_count' increments.
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireRole } from '@/lib/errors'
import { inspectJob } from '@/lib/repositories/jobs'

const Schema = z.object({
  result: z.enum(['approved', 'rejected']),
  note:   z.string().max(2000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())

    const job = await inspectJob(db, params.id, body.result, profile.id, body.note)
    return ok(job)
  } catch (e) { return err(e) }
}

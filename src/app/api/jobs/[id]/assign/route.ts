/**
 * POST /api/jobs/[id]/assign
 * Body: { employee_id: string | null }
 *
 * Assign or reassign job. Pass null to unassign.
 * DB trigger handles notifying both old and new assignee.
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireRole } from '@/lib/errors'
import { assignJob } from '@/lib/repositories/jobs'

const Schema = z.object({
  employee_id: z.string().uuid().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db } = await requireRole('admin','manager')
    const { employee_id } = Schema.parse(await req.json())
    const job = await assignJob(db, params.id, employee_id)
    return ok(job)
  } catch (e) { return err(e) }
}

/**
 * GET  /api/jobs       — list (filtered by status, assigned_to)
 * POST /api/jobs       — create new job (admin/manager only)
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { listJobs, createJob, type JobStatus } from '@/lib/repositories/jobs'

const CreateSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().max(2000).optional(),
  assigned_to:      z.string().uuid().optional(),
  priority:         z.enum(['low','normal','high','urgent']).default('normal'),
  location:         z.string().max(300).optional(),
  scheduled_at:     z.string().datetime().optional(),
  customer_name:    z.string().max(120).optional(),
  customer_phone:   z.string().max(30).optional(),
  customer_address: z.string().max(500).optional(),
  estimated_cost:   z.coerce.number().min(0).optional(),
  notes:            z.string().max(2000).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const sp = req.nextUrl.searchParams

    // Employees only see their own jobs
    const assigned_to = profile.role === 'employee'
      ? profile.employee_id!
      : sp.get('assigned_to') ?? undefined

    const jobs = await listJobs(db, profile.org_id, {
      status:      (sp.get('status') as JobStatus) ?? undefined,
      assigned_to,
      search:      sp.get('search') ?? undefined,
    })
    return ok(jobs)
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = CreateSchema.parse(await req.json())
    const job  = await createJob(db, profile.org_id, profile.id, body)
    return created(job)
  } catch (e) { return err(e) }
}

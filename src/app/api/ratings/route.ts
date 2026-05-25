import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, err, requireAuth, requireRole } from '@/lib/errors'
import { Ratings } from '@/lib/repositories/enterprise'

const Schema = z.object({
  job_id:          z.string().uuid(),
  customer_id:     z.string().uuid().optional(),
  employee_id:     z.string().uuid().optional(),
  overall:         z.number().int().min(1).max(5),
  quality:         z.number().int().min(1).max(5).optional(),
  punctuality:     z.number().int().min(1).max(5).optional(),
  professionalism: z.number().int().min(1).max(5).optional(),
  cleanliness:     z.number().int().min(1).max(5).optional(),
  comment:         z.string().max(2000).optional(),
  recommended:     z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const { db } = await requireAuth()
    const sp = req.nextUrl.searchParams
    if (sp.get('job_id')) {
      return ok(await Ratings.listForJob(db, sp.get('job_id')!))
    }
    if (sp.get('employee_id')) {
      return ok(await Ratings.listForEmployee(db, sp.get('employee_id')!))
    }
    return ok([])
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const body = Schema.parse(await req.json())
    return created(await Ratings.create(db, profile.org_id, body as any))
  } catch (e) { return err(e) }
}

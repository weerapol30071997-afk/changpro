/**
 * POST /api/jobs/[id]/submit
 * multipart/form-data:
 *   photos[]:        File[] (1+ required, "after" photos)
 *   work_summary:    string (optional)
 *   materials_used:  string (optional)
 *   actual_cost:     number (optional)
 *   labor_hours:     number (optional)
 *
 * Technician submits finished work → transitions to 'awaiting_inspection'.
 */
import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, AppError } from '@/lib/errors'
import { uploadJobPhoto, submitJob } from '@/lib/repositories/jobs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { profile, db } = await requireAuth()
    if (!profile.employee_id)
      throw new AppError('NO_EMPLOYEE_RECORD', 'บัญชีของคุณยังไม่ได้ผูกกับข้อมูลพนักงาน', 400)

    const form   = await req.formData()
    const photos = form.getAll('photos').filter(f => f instanceof File) as File[]
    if (photos.length === 0)
      throw new AppError('AFTER_PHOTOS_REQUIRED', 'กรุณาถ่ายรูปหลังทำงานอย่างน้อย 1 รูป', 400)

    for (const p of photos) {
      if (p.size > 10 * 1024 * 1024)
        throw new AppError('PHOTO_TOO_LARGE', 'รูปต้องไม่เกิน 10MB ต่อรูป', 400)
    }

    const urls = await Promise.all(
      photos.map(p => uploadJobPhoto(db, params.id, p, 'after'))
    )

    const job = await submitJob(db, params.id, {
      after_photos:   urls,
      work_summary:   (form.get('work_summary')   as string) || undefined,
      materials_used: (form.get('materials_used') as string) || undefined,
      actual_cost:    form.get('actual_cost') ? Number(form.get('actual_cost')) : undefined,
      labor_hours:    form.get('labor_hours') ? Number(form.get('labor_hours')) : undefined,
    }, profile.employee_id)

    return ok(job)
  } catch (e) { return err(e) }
}

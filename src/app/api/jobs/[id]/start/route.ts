/**
 * POST /api/jobs/[id]/start
 * multipart/form-data:
 *   photos: File[] (1+ required)
 *
 * Technician starts the job — uploads "before" photos, transitions to 'inprogress'.
 */
import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, AppError } from '@/lib/errors'
import { uploadJobPhoto, startJob } from '@/lib/repositories/jobs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { profile, db } = await requireAuth()
    if (!profile.employee_id)
      throw new AppError('NO_EMPLOYEE_RECORD', 'บัญชีของคุณยังไม่ได้ผูกกับข้อมูลพนักงาน', 400)

    const form   = await req.formData()
    const photos = form.getAll('photos').filter(f => f instanceof File) as File[]

    if (photos.length === 0)
      throw new AppError('BEFORE_PHOTOS_REQUIRED', 'กรุณาถ่ายรูปก่อนเริ่มงานอย่างน้อย 1 รูป', 400)

    // Validate each
    for (const p of photos) {
      if (p.size > 10 * 1024 * 1024)
        throw new AppError('PHOTO_TOO_LARGE', 'รูปต้องไม่เกิน 10MB ต่อรูป', 400)
    }

    // Upload all photos in parallel
    const urls = await Promise.all(
      photos.map(p => uploadJobPhoto(db, params.id, p, 'before'))
    )

    // Save to job
    const job = await startJob(db, params.id, urls, profile.employee_id)
    return ok(job)
  } catch (e) { return err(e) }
}

/**
 * POST /api/timeclock/in
 * multipart/form-data:
 *   photo: File (required)
 *   lat:   string (required)
 *   lng:   string (required)
 *   accuracy_m: string (optional)
 *   site_id: string (optional)
 *   device:  string (optional)
 *   note:    string (optional)
 */
import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, AppError } from '@/lib/errors'
import { clockIn, uploadClockPhoto } from '@/lib/repositories/timeLogs'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    if (!profile.employee_id)
      throw new AppError('NO_EMPLOYEE_RECORD', 'บัญชีของคุณยังไม่ได้ผูกกับข้อมูลพนักงาน', 400)

    const form = await req.formData()
    const photo = form.get('photo') as File | null
    const lat   = Number(form.get('lat'))
    const lng   = Number(form.get('lng'))

    if (!photo || !(photo instanceof File))
      throw new AppError('PHOTO_REQUIRED', 'กรุณาถ่ายรูปก่อนลงเวลา (บังคับ)', 400)
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      throw new AppError('GPS_REQUIRED', 'ไม่สามารถระบุตำแหน่ง GPS ได้', 400)
    if (photo.size > 5 * 1024 * 1024)
      throw new AppError('PHOTO_TOO_LARGE', 'รูปต้องมีขนาดไม่เกิน 5MB', 400)

    // 1. Upload photo first
    const photo_url = await uploadClockPhoto(db, profile.employee_id, photo, 'in')

    // 2. Create log
    const log = await clockIn(db, {
      org_id:      profile.org_id,
      employee_id: profile.employee_id,
      coords: {
        lat, lng,
        accuracy_m: form.get('accuracy_m') ? Number(form.get('accuracy_m')) : undefined,
      },
      photo_url,
      site_id: (form.get('site_id') as string) || undefined,
      device:  (form.get('device')  as string) || undefined,
      note:    (form.get('note')    as string) || undefined,
    })

    return ok(log, 201)
  } catch (e) { return err(e) }
}

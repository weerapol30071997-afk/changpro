/**
 * POST /api/timeclock/ping
 * Employee sends GPS coordinates while clocked in.
 * Body: { lat, lng, accuracy_m?, speed_mps?, battery_pct? }
 *
 * DB trigger handles geofence breach detection + admin notification.
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireAuth, AppError } from '@/lib/errors'
import { pingLocation, getTodayLog } from '@/lib/repositories/timeLogs'

const Schema = z.object({
  lat:         z.number().min(-90).max(90),
  lng:         z.number().min(-180).max(180),
  accuracy_m:  z.number().min(0).max(10000).optional(),
  speed_mps:   z.number().min(0).max(200).optional(),
  battery_pct: z.number().int().min(0).max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    if (!profile.employee_id)
      throw new AppError('NO_EMPLOYEE_RECORD', 'บัญชีของคุณยังไม่ได้ผูกกับข้อมูลพนักงาน', 400)

    // Must have an open session to ping
    const today = await getTodayLog(db, profile.employee_id)
    if (!today)             throw new AppError('NO_OPEN_SESSION', 'ยังไม่ได้เข้างาน', 400)
    if (today.clock_out)    throw new AppError('SESSION_CLOSED',   'ออกงานแล้ว ไม่สามารถ ping ได้', 400)

    const body  = Schema.parse(await req.json())
    const track = await pingLocation(db, {
      org_id:      profile.org_id,
      time_log_id: today.id,
      employee_id: profile.employee_id,
      ...body,
    })

    return ok({ track_id: track.id })
  } catch (e) { return err(e) }
}

/**
 * GET /api/timeclock/tracks?log_id=...
 * Returns location track points for a session. Admin/manager OR own log.
 */
import { type NextRequest } from 'next/server'
import { ok, err, requireAuth, AppError } from '@/lib/errors'
import { getTracksForSession } from '@/lib/repositories/timeLogs'

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const log_id = req.nextUrl.searchParams.get('log_id')
    if (!log_id) throw new AppError('LOG_ID_REQUIRED', 'ต้องระบุ log_id', 400)

    const tracks = await getTracksForSession(db, log_id, 500)
    return ok({ tracks })
  } catch (e) { return err(e) }
}

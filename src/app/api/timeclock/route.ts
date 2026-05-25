import { type NextRequest } from 'next/server'
import { ok, err, requireAuth } from '@/lib/errors'
import { listTimeLogs, getTodayLog } from '@/lib/repositories/timeLogs'

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const sp = req.nextUrl.searchParams

    const employee_id = profile.role === 'employee'
      ? profile.employee_id!
      : (sp.get('employee_id') ?? undefined)

    const logs = await listTimeLogs(db, profile.org_id, {
      employee_id,
      from:  sp.get('from')  ?? undefined,
      to:    sp.get('to')    ?? undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : 100,
    })

    const today_log = profile.employee_id
      ? await getTodayLog(db, profile.employee_id)
      : null

    return ok({ logs, today_log })
  } catch (e) { return err(e) }
}

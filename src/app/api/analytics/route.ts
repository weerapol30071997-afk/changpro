/**
 * GET /api/analytics?kind=overview|performance|revenue&year=2026
 */
import { type NextRequest } from 'next/server'
import { ok, err, requireRole } from '@/lib/errors'
import { Analytics } from '@/lib/repositories/enterprise'

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireRole('admin','manager')
    const sp   = req.nextUrl.searchParams
    const kind = sp.get('kind') ?? 'overview'

    if (kind === 'overview')    return ok(await Analytics.overview(db, profile.org_id))
    if (kind === 'performance') return ok(await Analytics.employeePerformance(db, profile.org_id))
    if (kind === 'revenue') {
      const year = sp.get('year') ? Number(sp.get('year')) : new Date().getFullYear()
      return ok(await Analytics.monthlyRevenue(db, profile.org_id, year))
    }
    return ok({})
  } catch (e) { return err(e) }
}

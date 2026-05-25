import { ok, err, requireAuth } from '@/lib/errors'

export async function GET() {
  try {
    const { profile } = await requireAuth()
    return ok({
      id:           profile.id,
      org_id:       profile.org_id,
      full_name:    profile.full_name,
      avatar_url:   profile.avatar_url,
      role:         profile.role,
      employee_id:  profile.employee_id,
    })
  } catch (e) { return err(e) }
}

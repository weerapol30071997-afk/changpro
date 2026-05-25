/**
 * GET    /api/notifications              — list
 * POST   /api/notifications/read         — mark single read
 * POST   /api/notifications/read-all     — mark all read
 * POST   /api/notifications/subscribe    — register push subscription
 * DELETE /api/notifications/subscribe    — unregister
 */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, err, requireAuth } from '@/lib/errors'
import {
  listNotifications, countUnread,
  markRead, markAllRead,
  savePushSubscription, deletePushSubscription,
} from '@/lib/repositories/notifications'

export async function GET(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const sp = req.nextUrl.searchParams

    const unread_only = sp.get('unread_only') === '1'
    const limit       = sp.get('limit') ? Number(sp.get('limit')) : 30

    const [items, unread_count] = await Promise.all([
      listNotifications(db, profile.id, { unread_only, limit }),
      countUnread(db, profile.id),
    ])

    return ok({ items, unread_count })
  } catch (e) { return err(e) }
}

export async function POST(req: NextRequest) {
  try {
    const { profile, db } = await requireAuth()
    const url = new URL(req.url)
    const action = url.pathname.split('/').pop()

    if (action === 'read-all') {
      await markAllRead(db, profile.id)
      return ok({ marked: 'all' })
    }

    if (action === 'read') {
      const { id } = z.object({ id: z.string().uuid() }).parse(await req.json())
      await markRead(db, id)
      return ok({ marked: id })
    }

    if (action === 'subscribe') {
      const body = z.object({
        endpoint: z.string().url(),
        keys:     z.object({ p256dh: z.string(), auth: z.string() }),
      }).parse(await req.json())
      await savePushSubscription(db, profile.id, body, req.headers.get('user-agent') ?? undefined)
      return ok({ subscribed: true })
    }

    return err(new Error('Unknown action'))
  } catch (e) { return err(e) }
}

export async function DELETE(req: NextRequest) {
  try {
    const { db } = await requireAuth()
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await req.json())
    await deletePushSubscription(db, endpoint)
    return ok({ unsubscribed: true })
  } catch (e) { return err(e) }
}

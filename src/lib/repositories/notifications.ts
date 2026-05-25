import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/database'
import { type AppNotification, type NotificationKind } from '@/types/tracking'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

export async function listNotifications(
  db: DB,
  recipient_id: string,
  options: { unread_only?: boolean; limit?: number } = {}
): Promise<AppNotification[]> {
  let query = (db as any)
    .from('notifications')
    .select('*')
    .eq('recipient_id', recipient_id)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 50)

  if (options.unread_only) query = query.is('read_at', null)

  const { data, error } = await query
  if (error) throw new AppError('FETCH_NOTIFICATIONS_FAILED', error.message)
  return data
}

export async function countUnread(db: DB, recipient_id: string): Promise<number> {
  const { count, error } = await (db as any)
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipient_id)
    .is('read_at', null)
  if (error) throw new AppError('COUNT_UNREAD_FAILED', error.message)
  return count ?? 0
}

export async function markRead(db: DB, id: string): Promise<void> {
  const { error } = await (db as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new AppError('MARK_READ_FAILED', error.message)
}

export async function markAllRead(db: DB, recipient_id: string): Promise<void> {
  const { error } = await (db as any)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', recipient_id)
    .is('read_at', null)
  if (error) throw new AppError('MARK_ALL_READ_FAILED', error.message)
}

// ─── Push subscription management ────────────────────────────
export async function savePushSubscription(
  db: DB,
  user_id: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  user_agent?: string
) {
  const { error } = await (db as any)
    .from('push_subscriptions')
    .upsert({
      user_id,
      endpoint:   sub.endpoint,
      p256dh:     sub.keys.p256dh,
      auth:       sub.keys.auth,
      user_agent: user_agent ?? null,
    }, { onConflict: 'endpoint' })

  if (error) throw new AppError('SAVE_PUSH_FAILED', error.message)
}

export async function deletePushSubscription(db: DB, endpoint: string) {
  const { error } = await (db as any)
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
  if (error) throw new AppError('DELETE_PUSH_FAILED', error.message)
}

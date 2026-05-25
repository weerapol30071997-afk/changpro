'use client'
/**
 * NotificationBell
 * - Real-time admin notifications via Supabase Realtime
 * - Shows unread count badge
 * - Opens panel with full list
 * - Auto-plays sound + toast on new notification (clock in/out/geofence)
 */
import { useEffect, useRef, useState } from 'react'
import { Bell, MapPin, AlertTriangle, CheckCircle2, X, LogIn, LogOut } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { AppNotification } from '@/types/tracking'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const ICONS: Record<string, React.ComponentType<any>> = {
  clock_in:        LogIn,
  clock_out:       LogOut,
  geofence_exit:   AlertTriangle,
  geofence_return: CheckCircle2,
  long_idle:       AlertTriangle,
  payroll_approved: CheckCircle2,
  payroll_paid:    CheckCircle2,
  job_assigned:    Bell,
}

const COLORS: Record<string, string> = {
  clock_in:        'text-green-600 bg-green-50',
  clock_out:       'text-red-500 bg-red-50',
  geofence_exit:   'text-amber-600 bg-amber-50',
  geofence_return: 'text-green-600 bg-green-50',
  long_idle:       'text-amber-600 bg-amber-50',
  payroll_approved: 'text-blue-600 bg-blue-50',
  payroll_paid:    'text-green-600 bg-green-50',
  job_assigned:    'text-purple-600 bg-purple-50',
}

export function NotificationBell({ userId, orgId }: { userId: string; orgId: string }) {
  const [open, setOpen] = useState(false)
  const { data } = useSWR<{ items: AppNotification[]; unread_count: number }>(
    '/api/notifications?limit=20',
    fetcher,
    { refreshInterval: 30_000 }
  )
  const unread = data?.unread_count ?? 0
  const items  = data?.items ?? []
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Realtime subscription ────────────────────────────────
  useEffect(() => {
  if (!userId) return

  const supabase = getSupabaseBrowserClient()
  
  // ลบ channel เก่าถ้ามี
  supabase.removeChannel(supabase.channel(`notif-${userId}`))

  const ch = supabase
    .channel(`notif-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${userId}`,
    }, (payload) => {
      const n = payload.new as AppNotification
      // Play sound
      audioRef.current?.play().catch(() => {})

        // Toast
        const Icon = ICONS[n.kind] ?? Bell
        toast.custom((t) => (
          <div className="bg-white shadow-2xl rounded-2xl p-4 flex gap-3 max-w-sm border border-gray-100">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${COLORS[n.kind] ?? 'bg-gray-100 text-gray-600'}`}>
              <Icon size={18}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm">{n.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>
            </div>
            <button onClick={() => toast.dismiss(t)} className="text-gray-400">
              <X size={16}/>
            </button>
          </div>
        ), { duration: 6000 })
        // Refresh list
        mutate('/api/notifications?limit=20')
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    mutate('/api/notifications?limit=20')
  }

  async function markOne(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    mutate('/api/notifications?limit=20')
  }

  return (
    <>
      {/* Bell button */}
      <button onClick={() => setOpen(true)} className="relative p-2">
        <Bell size={20} className="text-gray-700"/>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px]
            font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Hidden audio for new notifications */}
      <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto"/>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end fade-in" onClick={() => setOpen(false)}>
          <aside className="w-full max-w-md h-dvh bg-white shadow-2xl slide-up flex flex-col"
            onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b">
              <h2 className="font-black text-lg">🔔 การแจ้งเตือน</h2>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-blue-600 font-bold">
                    อ่านทั้งหมด
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-2 -mr-2">
                  <X size={20}/>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              {items.length === 0 && (
                <div className="p-12 text-center text-gray-400">
                  <Bell size={36} className="mx-auto mb-3 opacity-50"/>
                  <p className="text-sm">ยังไม่มีการแจ้งเตือน</p>
                </div>
              )}
              {items.map(n => {
                const Icon = ICONS[n.kind] ?? Bell
                return (
                  <button key={n.id} onClick={() => markOne(n.id)}
                    className={`w-full text-left p-4 border-b flex gap-3 transition-colors
                      ${!n.read_at ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${COLORS[n.kind] ?? 'bg-gray-100 text-gray-600'}`}>
                      <Icon size={18}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm">{n.title}</div>
                        {!n.read_at && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5"/>}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">{n.body}</div>
                      {n.data?.lat && n.data?.lng && (
                        <a href={`https://www.google.com/maps?q=${n.data.lat},${n.data.lng}`}
                          target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] text-blue-600 mt-1 inline-flex items-center gap-1">
                          <MapPin size={11}/> ดูบนแผนที่
                        </a>
                      )}
                      <div className="text-[10px] text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { locale: th, addSuffix: true })}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

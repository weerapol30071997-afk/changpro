'use client'
/**
 * LiveTrackingMap
 * - Polls /api/timeclock every 30s to find clocked-in employees
 * - Fetches each session's latest track point
 * - Renders simple list with last-known location + distance from site
 * - For full map view, swap to Leaflet or Mapbox (kept iframe-free here for simplicity)
 */
import useSWR from 'swr'
import { useState } from 'react'
import { MapPin, Clock, AlertTriangle, ExternalLink, Battery } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { distanceMeters } from '@/lib/repositories/workSites'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

export function LiveTrackingMap() {
  const { data: timeData } = useSWR('/api/timeclock?limit=20', fetcher, { refreshInterval: 30_000 })
  const { data: sites }    = useSWR('/api/sites',              fetcher)
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)

  const liveSessions = (timeData?.logs ?? []).filter((l: any) => l.clock_in && !l.clock_out)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">การติดตามแบบเรียลไทม์</h1>
        <p className="text-sm text-gray-500 mt-1">
          {liveSessions.length} คนกำลังทำงาน · อัปเดตทุก 30 วินาที
        </p>
      </div>

      {liveSessions.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <MapPin size={48} className="mx-auto mb-3 opacity-40"/>
          <p>ยังไม่มีพนักงานเข้างาน</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liveSessions.map((session: any) => (
            <LiveSessionCard
              key={session.id}
              session={session}
              sites={sites ?? []}
              expanded={selectedLogId === session.id}
              onToggle={() => setSelectedLogId(selectedLogId === session.id ? null : session.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LiveSessionCard({ session, sites, expanded, onToggle }: any) {
  const { data: trackData } = useSWR(
    expanded ? `/api/timeclock/tracks?log_id=${session.id}` : null,
    fetcher,
    { refreshInterval: expanded ? 30_000 : 0 }
  )
  const tracks = trackData?.tracks ?? []
  const latest = tracks[tracks.length - 1]

  const site = session.site_id ? sites.find((s: any) => s.id === session.site_id) : null
  const distance = (site && latest)
    ? distanceMeters(latest.lat, latest.lng, site.lat, site.lng)
    : null
  const outside = site && distance !== null && distance > site.radius_m

  return (
    <div className={`card p-4 ${outside ? 'border-amber-300 bg-amber-50/30' : ''}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold
            flex items-center justify-center text-lg shrink-0">
            {session.employee?.full_name?.[0] ?? '?'}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500
            border-2 border-white animate-pulse"/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{session.employee?.full_name}</div>
          <div className="text-xs text-gray-500">{session.employee?.role}</div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <Clock size={12}/>
            เข้างาน {format(new Date(session.clock_in), 'HH:mm')}
            {' '}({formatDistanceToNow(new Date(session.clock_in), { locale: th })})
          </div>
        </div>
        {outside && (
          <div className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full
            flex items-center gap-1 shrink-0">
            <AlertTriangle size={12}/> นอกพื้นที่
          </div>
        )}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {site && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">พื้นที่: <b>{site.name}</b> ({site.radius_m} ม.)</span>
              {distance !== null && (
                <span className={outside ? 'text-amber-700 font-bold' : 'text-green-600 font-bold'}>
                  {Math.round(distance)} ม. จากจุดศูนย์กลาง
                </span>
              )}
            </div>
          )}

          {latest && (
            <div className="bg-gray-50 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">ตำแหน่งล่าสุด</span>
                <span>{formatDistanceToNow(new Date(latest.recorded_at), { locale: th, addSuffix: true })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">พิกัด</span>
                <a href={`https://www.google.com/maps?q=${latest.lat},${latest.lng}`}
                  target="_blank" rel="noreferrer"
                  className="text-blue-600 font-mono inline-flex items-center gap-1">
                  {latest.lat.toFixed(5)}, {latest.lng.toFixed(5)} <ExternalLink size={10}/>
                </a>
              </div>
              {latest.accuracy_m && (
                <div className="flex justify-between">
                  <span className="text-gray-500">ความแม่นยำ</span>
                  <span>±{Math.round(latest.accuracy_m)} ม.</span>
                </div>
              )}
              {latest.battery_pct !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1">
                    <Battery size={11}/> แบตเตอรี่
                  </span>
                  <span className={latest.battery_pct < 20 ? 'text-red-500 font-bold' : ''}>
                    {latest.battery_pct}%
                  </span>
                </div>
              )}
            </div>
          )}

          {tracks.length > 0 && (
            <div className="text-xs text-gray-400">
              จำนวน ping ทั้งหมด: {tracks.length} จุด · ระยะทางประมาณ {estimateDistance(tracks).toFixed(2)} กม.
            </div>
          )}

          {session.clock_in_photo_url && (
            <div>
              <div className="text-xs text-gray-500 mb-1">รูปเข้างาน</div>
              <img src={session.clock_in_photo_url} alt="clock in"
                className="w-32 aspect-square object-cover rounded-xl"/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function estimateDistance(tracks: any[]): number {
  let total = 0
  for (let i = 1; i < tracks.length; i++) {
    total += distanceMeters(tracks[i-1].lat, tracks[i-1].lng, tracks[i].lat, tracks[i].lng)
  }
  return total / 1000
}

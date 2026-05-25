'use client'
/**
 * ClockCard — the main clock in/out widget for employees.
 * Flow:
 *   1. Tap "เข้างาน" → request GPS → open camera → confirm → upload → POST
 *   2. While clocked in → useLocationTracker pings every 60s
 *   3. Tap "ออกงาน" → same flow
 */
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { MapPin, Camera, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import useSWR, { mutate } from 'swr'
import { CameraCapture } from './CameraCapture'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useLocationTracker } from '@/hooks/useLocationTracker'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

type Step = 'idle' | 'requesting_gps' | 'opening_camera' | 'uploading'

export function ClockCard() {
  const { data, isLoading } = useSWR('/api/timeclock?limit=1', fetcher)
  const todayLog = data?.today_log

  const { data: sitesData } = useSWR('/api/sites', fetcher)
  const sites = sitesData ?? []

  const [step,       setStep]       = useState<Step>('idle')
  const [showCamera, setShowCamera] = useState<'in' | 'out' | null>(null)
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [pendingCoords, setPendingCoords] = useState<any>(null)
  const { request: requestGPS } = useGeolocation()
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  // Live location tracking
  const isClockedIn = !!todayLog && !todayLog.clock_out
  useLocationTracker(isClockedIn, todayLog?.id ?? null)

  // ─── Start clock-in flow ─────────────────────────────────
  async function startClock(kind: 'in' | 'out') {
    if (kind === 'in' && isClockedIn) { toast.error('คุณเข้างานอยู่แล้ว'); return }
    if (kind === 'out' && !isClockedIn) { toast.error('ยังไม่ได้เข้างาน'); return }

    setStep('requesting_gps')
    try {
      const coords = await requestGPS()
      setPendingCoords(coords)
      setStep('opening_camera')
      setShowCamera(kind)
    } catch (e: any) {
      toast.error(e.message)
      setStep('idle')
    }
  }

  // ─── Photo captured → upload ─────────────────────────────
  async function onPhotoCaptured(blob: Blob) {
    const kind = showCamera!
    setShowCamera(null)
    setStep('uploading')

    try {
      const form = new FormData()
      form.append('photo',      blob, `${kind}.jpg`)
      form.append('lat',        String(pendingCoords.lat))
      form.append('lng',        String(pendingCoords.lng))
      form.append('accuracy_m', String(pendingCoords.accuracy_m))
      form.append('device',     navigator.userAgent.substring(0, 200))
      if (kind === 'in' && selectedSite) form.append('site_id', selectedSite)

      const res  = await fetch(`/api/timeclock/${kind}`, { method: 'POST', body: form })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)

      toast.success(kind === 'in' ? `เข้างาน ${format(new Date(), 'HH:mm')} แล้ว ✅` : `ออกงาน ${format(new Date(), 'HH:mm')} แล้ว ✅`)
      await mutate('/api/timeclock?limit=1')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setStep('idle')
      setPendingCoords(null)
    }
  }

  function cancelCamera() { setShowCamera(null); setStep('idle'); setPendingCoords(null) }

  // ─── Loading ───────────────────────────────────────────
  if (isLoading) return (
    <div className="card p-6 flex items-center justify-center"><Loader2 className="animate-spin"/></div>
  )

  return (
    <>
      {/* ─── Clock display ─── */}
      <div className="rounded-3xl p-6 mb-4 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0a0f1e 0%,#1a3a8f 50%,#0a0f1e 100%)' }}>
        <div className="absolute right-4 top-4 opacity-40">
          <MapPin size={64}/>
        </div>
        <div className="font-mono text-5xl font-black tracking-wider">
          {format(now, 'HH:mm:ss')}
        </div>
        <div className="text-sm text-white/70 mt-1">
          {format(now, 'EEEE d MMMM yyyy', { locale: th })}
        </div>

        {/* Session status */}
        {isClockedIn ? (
          <div className="mt-4 p-3 bg-green-500/20 border border-green-400/30 rounded-xl
            flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-sm">
              เข้างานตั้งแต่ {format(new Date(todayLog.clock_in), 'HH:mm')}
              {' · '}กำลังติดตามตำแหน่ง
            </span>
          </div>
        ) : todayLog?.clock_out ? (
          <div className="mt-4 p-3 bg-white/10 rounded-xl text-sm">
            ✅ วันนี้ลงเวลาครบแล้ว
          </div>
        ) : (
          <div className="mt-4 p-3 bg-white/10 rounded-xl text-sm">
            ⏰ ยังไม่ได้ลงเวลา
          </div>
        )}
      </div>

      {/* ─── Site selector (clock in only) ─── */}
      {!isClockedIn && !todayLog?.clock_out && sites.length > 0 && (
        <div className="card p-4 mb-4">
          <label className="block text-xs font-bold text-gray-700 mb-2">📍 พื้นที่ลงเวลา (ไม่บังคับ)</label>
          <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)} className="input">
            <option value="">-- ลงเวลาที่ไหนก็ได้ --</option>
            {sites.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} (รัศมี {s.radius_m} ม.)</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            เลือกพื้นที่เพื่อเปิด geofence — ระบบจะแจ้งเตือนแอดมินถ้าออกนอกพื้นที่
          </p>
        </div>
      )}

      {/* ─── Action button ─── */}
      <div className="card p-4 mb-4">
        {!isClockedIn && !todayLog?.clock_out && (
          <button onClick={() => startClock('in')} disabled={step !== 'idle'}
            className="w-full btn-success text-base min-h-[64px]">
            {step === 'idle' && <><Camera size={20}/> เข้างาน (ถ่ายรูปบังคับ)</>}
            {step === 'requesting_gps' && <><Loader2 className="animate-spin" size={20}/> กำลังหาตำแหน่ง...</>}
            {step === 'opening_camera' && <><Loader2 className="animate-spin" size={20}/> กำลังเปิดกล้อง...</>}
            {step === 'uploading' && <><Loader2 className="animate-spin" size={20}/> กำลังอัปโหลด...</>}
          </button>
        )}

        {isClockedIn && (
          <button onClick={() => startClock('out')} disabled={step !== 'idle'}
            className="w-full btn-danger text-base min-h-[64px]">
            {step === 'idle' && <><Camera size={20}/> ออกงาน (ถ่ายรูปบังคับ)</>}
            {step === 'requesting_gps' && <><Loader2 className="animate-spin" size={20}/> กำลังหาตำแหน่ง...</>}
            {step === 'opening_camera' && <><Loader2 className="animate-spin" size={20}/> กำลังเปิดกล้อง...</>}
            {step === 'uploading' && <><Loader2 className="animate-spin" size={20}/> กำลังอัปโหลด...</>}
          </button>
        )}

        {todayLog?.clock_out && (
          <div className="text-center py-4">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-2"/>
            <div className="font-bold">ลงเวลาครบแล้ว</div>
            <div className="text-xs text-gray-500 mt-1">
              {format(new Date(todayLog.clock_in), 'HH:mm')} → {format(new Date(todayLog.clock_out), 'HH:mm')}
            </div>
          </div>
        )}
      </div>

      {/* ─── Photos preview ─── */}
      {todayLog && (
        <div className="card p-4 mb-4">
          <h3 className="font-bold text-sm mb-3">รูปการลงเวลาวันนี้</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">เข้างาน {format(new Date(todayLog.clock_in), 'HH:mm')}</div>
              {todayLog.clock_in_photo_url
                ? <img src={todayLog.clock_in_photo_url} alt="in" className="w-full aspect-square object-cover rounded-xl"/>
                : <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                    <AlertCircle/>
                  </div>}
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">
                ออกงาน {todayLog.clock_out ? format(new Date(todayLog.clock_out), 'HH:mm') : '—'}
              </div>
              {todayLog.clock_out_photo_url
                ? <img src={todayLog.clock_out_photo_url} alt="out" className="w-full aspect-square object-cover rounded-xl"/>
                : <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-xs">
                    รอออกงาน
                  </div>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Camera modal ─── */}
      {showCamera && (
        <CameraCapture
          onCapture={blob => onPhotoCaptured(blob)}
          onCancel={cancelCamera}
        />
      )}
    </>
  )
}

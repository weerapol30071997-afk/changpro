'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { MapPin, Plus, Loader2 } from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import type { WorkSite } from '@/types/tracking'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

export default function SitesPage() {
  const { data: sites = [] } = useSWR<WorkSite[]>('/api/sites', fetcher)
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">พื้นที่ลงเวลา</h1>
          <p className="text-sm text-gray-500">กำหนด geofence สำหรับติดตามพนักงาน</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18}/> เพิ่ม</button>
      </div>

      <div className="space-y-3">
        {sites.length === 0 && (
          <div className="card p-12 text-center text-gray-400">
            <MapPin size={36} className="mx-auto mb-3 opacity-50"/>
            <p>ยังไม่มีพื้นที่ — กดเพิ่มเพื่อเริ่มต้น</p>
          </div>
        )}
        {sites.map(s => (
          <div key={s.id} className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <MapPin/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold">{s.name}</div>
              <div className="text-xs text-gray-500 truncate">{s.address ?? '—'}</div>
              <div className="text-[11px] text-gray-400 mt-1">
                {s.lat.toFixed(5)}, {s.lng.toFixed(5)} · รัศมี {s.radius_m} ม.
              </div>
            </div>
            <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600">ดูแผนที่</a>
          </div>
        ))}
      </div>

      {showForm && <SiteForm onClose={() => setShowForm(false)}/>}
    </div>
  )
}

function SiteForm({ onClose }: { onClose: () => void }) {
  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [lat,     setLat]     = useState('')
  const [lng,     setLng]     = useState('')
  const [radius,  setRadius]  = useState('150')
  const [saving,  setSaving]  = useState(false)
  const { request: requestGPS, state: geoState } = useGeolocation()

  async function useCurrentLocation() {
    try {
      const c = await requestGPS()
      setLat(c.lat.toFixed(6))
      setLng(c.lng.toFixed(6))
      toast.success('ใช้ตำแหน่งปัจจุบัน')
    } catch (e: any) { toast.error(e.message) }
  }

  async function save() {
    if (!name.trim() || !lat || !lng) { toast.error('กรอกข้อมูลให้ครบ'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, address: address || undefined,
          lat: Number(lat), lng: Number(lng),
          radius_m: Number(radius),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('เพิ่มพื้นที่แล้ว')
      mutate('/api/sites')
      onClose()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl p-6 slide-up" onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4"/>
        <h2 className="font-black text-lg mb-4">เพิ่มพื้นที่ลงเวลา</h2>

        <div className="space-y-3">
          <Field label="ชื่อพื้นที่"><input value={name} onChange={e=>setName(e.target.value)} className="input"/></Field>
          <Field label="ที่อยู่ (ถ้ามี)"><input value={address} onChange={e=>setAddress(e.target.value)} className="input"/></Field>
          <Field label="พิกัด" hint="ใช้ตำแหน่งปัจจุบันหรือกรอกเอง">
            <div className="grid grid-cols-2 gap-2">
              <input value={lat} onChange={e=>setLat(e.target.value)} placeholder="latitude" className="input"/>
              <input value={lng} onChange={e=>setLng(e.target.value)} placeholder="longitude" className="input"/>
            </div>
            <button type="button" onClick={useCurrentLocation}
              disabled={geoState.kind === 'requesting'}
              className="mt-2 text-xs text-blue-600 font-bold flex items-center gap-1">
              {geoState.kind === 'requesting' ? <Loader2 className="animate-spin" size={12}/> : <MapPin size={12}/>}
              ใช้ตำแหน่งปัจจุบัน
            </button>
          </Field>
          <Field label="รัศมี (เมตร)" hint="ระยะที่อนุญาตให้ออกจากศูนย์กลาง">
            <input type="number" value={radius} onChange={e=>setRadius(e.target.value)}
              min="20" max="5000" className="input"/>
          </Field>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : '💾'} บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      {hint && <div className="text-[11px] text-gray-400 mb-1">{hint}</div>}
      {children}
    </div>
  )
}

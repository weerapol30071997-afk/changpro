'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { Wrench, Plus, Search, Edit2, X, Loader2, Tag, Clock as ClockIcon } from 'lucide-react'
import type { Service } from '@/types/enterprise'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH').format(n)

const CATEGORIES = ['ทั้งหมด','ไฟฟ้า','ประปา','แอร์','ก่อสร้าง','ทาสี','ปูกระเบื้อง','ทั่วไป']

export default function ServicesPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ทั้งหมด')
  const [editing, setEditing] = useState<Service | 'new' | null>(null)

  const { data: services = [] } = useSWR<Service[]>('/api/services', fetcher)

  const filtered = services.filter(s =>
    (category === 'ทั้งหมด' || s.category === category) &&
    (!search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">บริการ</h1>
          <p className="text-sm text-gray-500">รายการบริการพร้อมราคามาตรฐาน · {services.length} รายการ</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary">
          <Plus size={18}/> เพิ่ม
        </button>
      </div>

      <div className="card p-3 mb-3 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหา..." className="input pl-9"/>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${
                category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Wrench size={36} className="mx-auto mb-3 opacity-40"/>
          <p>ยังไม่มีบริการ — กดเพิ่มเพื่อสร้าง template ใช้ตอนรับงาน</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-2">
          {filtered.map(s => (
            <button key={s.id} onClick={() => setEditing(s)}
              className="card p-4 text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Wrench size={20}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{s.name}</span>
                    {s.code && <span className="font-mono text-[10px] text-gray-400">{s.code}</span>}
                  </div>
                  {s.category && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 mt-1">
                      {s.category}
                    </span>
                  )}
                  {s.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="font-bold text-purple-700">
                      {thbN(Number(s.default_price))} ฿/{s.unit}
                    </span>
                    {s.est_duration_min && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <ClockIcon size={11}/> {s.est_duration_min} นาที
                      </span>
                    )}
                    <span className="text-gray-400">ใช้ {s.use_count}×</span>
                  </div>
                  {s.required_skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.required_skills.slice(0, 3).map((sk, i) => (
                        <span key={i} className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                          {sk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <ServiceForm
          initial={editing === 'new' ? undefined : editing}
          onSuccess={() => { setEditing(null); mutate('/api/services') }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ServiceForm({ initial, onSuccess, onClose }: { initial?: Service; onSuccess: () => void; onClose: () => void }) {
  const [v, setV] = useState({
    name:             initial?.name             ?? '',
    code:             initial?.code             ?? '',
    category:         initial?.category         ?? 'ทั่วไป',
    description:      initial?.description      ?? '',
    default_price:    initial?.default_price    ?? 0,
    unit:             initial?.unit             ?? 'งาน',
    est_duration_min: initial?.est_duration_min ?? 0,
    default_priority: initial?.default_priority ?? 'normal',
    required_skills:  initial?.required_skills?.join(', ') ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!v.name.trim()) return toast.error('กรุณากรอกชื่อบริการ')
    setSaving(true)
    try {
      const url    = initial ? `/api/services/${initial.id}` : '/api/services'
      const method = initial ? 'PUT' : 'POST'
      const payload = {
        ...v,
        required_skills: v.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      }
      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(initial ? 'อัปเดตแล้ว' : 'เพิ่มบริการแล้ว')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[90dvh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="font-black">{initial ? 'แก้ไขบริการ' : 'เพิ่มบริการใหม่'}</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <F label="ชื่อบริการ *"><input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} className="input" placeholder="เช่น เปลี่ยนสวิตช์ไฟ"/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="รหัส"><input value={v.code} onChange={e => setV({ ...v, code: e.target.value })} className="input" placeholder="auto"/></F>
            <F label="หมวด">
              <select value={v.category} onChange={e => setV({ ...v, category: e.target.value })} className="input">
                {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </F>
          </div>
          <F label="รายละเอียด"><textarea value={v.description} onChange={e => setV({ ...v, description: e.target.value })} rows={2} className="input resize-none"/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="ราคามาตรฐาน (฿) *"><input type="number" min="0" step="0.01" value={v.default_price} onChange={e => setV({ ...v, default_price: Number(e.target.value) })} className="input font-bold text-purple-700"/></F>
            <F label="หน่วย"><input value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} className="input" placeholder="งาน/จุด/ตัว"/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="เวลาประมาณ (นาที)"><input type="number" min="0" value={v.est_duration_min} onChange={e => setV({ ...v, est_duration_min: Number(e.target.value) })} className="input"/></F>
            <F label="ความสำคัญ default">
              <select value={v.default_priority} onChange={e => setV({ ...v, default_priority: e.target.value as any })} className="input">
                <option value="low">ไม่ด่วน</option>
                <option value="normal">ปกติ</option>
                <option value="high">ด่วน</option>
                <option value="urgent">ด่วนมาก</option>
              </select>
            </F>
          </div>
          <F label="ทักษะที่ต้องการ (คั่นด้วย ,)">
            <input value={v.required_skills} onChange={e => setV({ ...v, required_skills: e.target.value })}
              className="input" placeholder="เช่น ไฟฟ้า, ใบช่างไฟ"/>
          </F>
        </div>
        <div className="px-4 py-3 border-t flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={save} disabled={saving} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : '💾'} บันทึก
          </button>
        </div>
      </div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import {
  Package, Plus, Search, AlertTriangle, TrendingUp, TrendingDown,
  Edit2, X, Loader2, ChevronRight, Box,
} from 'lucide-react'
import type { Material, MaterialMovement } from '@/types/enterprise'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH').format(n)

const CATEGORIES = ['ทั้งหมด','ไฟฟ้า','ประปา','แอร์','ก่อสร้าง','สี/เคมี','เครื่องมือ','อื่นๆ']
const KIND_LABEL: Record<string, { label: string; color: string }> = {
  in:           { label: 'รับเข้า',  color: 'bg-green-100 text-green-700' },
  out:          { label: 'จ่ายออก', color: 'bg-red-100 text-red-700' },
  job_consume:  { label: 'ใช้กับงาน', color: 'bg-blue-100 text-blue-700' },
  adjustment:   { label: 'ปรับ',     color: 'bg-amber-100 text-amber-700' },
}

export default function MaterialsPage() {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('ทั้งหมด')
  const [lowOnly, setLowOnly]   = useState(false)
  const [editing, setEditing]   = useState<Material | 'new' | null>(null)
  const [movement, setMovement] = useState<Material | null>(null)

  const qs = new URLSearchParams()
  if (lowOnly) qs.set('low_stock', '1')
  const { data: materials = [] } = useSWR<Material[]>(`/api/materials?${qs}`, fetcher)

  const filtered = materials.filter(m =>
    (category === 'ทั้งหมด' || m.category === category) &&
    (!search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.material_code?.toLowerCase().includes(search.toLowerCase()))
  )

  const lowStockCount = materials.filter(m => Number(m.stock_qty) <= Number(m.min_stock || 0)).length
  const totalValue    = materials.reduce((s, m) => s + Number(m.stock_qty) * Number(m.unit_cost || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">วัสดุ/สต๊อก</h1>
          <p className="text-sm text-gray-500">{materials.length} รายการ · มูลค่า {thbN(Math.round(totalValue))} ฿</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary">
          <Plus size={18}/> เพิ่ม
        </button>
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <button onClick={() => setLowOnly(!lowOnly)}
          className={`w-full mb-3 rounded-xl p-3 flex items-center gap-3 text-left
            ${lowOnly ? 'bg-red-100 border-2 border-red-300' : 'bg-amber-50 border border-amber-200'}`}>
          <AlertTriangle className="text-amber-600" size={20}/>
          <div className="flex-1">
            <div className="font-bold text-sm">
              {lowStockCount} รายการสต๊อกต่ำกว่าขั้นต่ำ
            </div>
            <div className="text-xs text-gray-600">
              {lowOnly ? 'แสดงเฉพาะที่ต้องเติม — กดเพื่อปิด' : 'กดเพื่อกรอง'}
            </div>
          </div>
          <ChevronRight size={16} className="text-amber-600"/>
        </button>
      )}

      {/* Search + filter */}
      <div className="card p-3 mb-3 space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาวัสดุ..." className="input pl-9"/>
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

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Package size={36} className="mx-auto mb-3 opacity-40"/>
          <p>{materials.length === 0 ? 'ยังไม่มีวัสดุ' : 'ไม่พบที่ตรงเงื่อนไข'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => {
            const isLow   = Number(m.stock_qty) <= Number(m.min_stock || 0)
            const value   = Number(m.stock_qty) * Number(m.unit_cost || 0)
            return (
              <div key={m.id} className={`card p-3 ${isLow ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    isLow ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Box size={20}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{m.name}</span>
                      {m.material_code && (
                        <span className="font-mono text-[10px] text-gray-400">{m.material_code}</span>
                      )}
                      {isLow && (
                        <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-[10px] font-bold">
                          สต๊อกต่ำ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {m.category && `${m.category} · `}{m.supplier ?? 'ไม่ระบุผู้ขาย'}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span>คงเหลือ <b className={isLow ? 'text-red-600' : 'text-gray-900'}>
                        {Number(m.stock_qty).toLocaleString()}
                      </b> {m.unit}</span>
                      <span className="text-gray-400">·</span>
                      <span>ต้นทุน <b>{thbN(Number(m.unit_cost))}</b> ฿</span>
                      {m.unit_price && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span>ขาย <b className="text-green-700">{thbN(Number(m.unit_price))}</b> ฿</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setMovement(m)} className="text-xs btn-primary px-2 py-1">
                      <TrendingUp size={12}/> รับ
                    </button>
                    <button onClick={() => setEditing(m)} className="text-xs btn-ghost px-2 py-1">
                      <Edit2 size={12}/>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <MaterialForm
          initial={editing === 'new' ? undefined : editing}
          onSuccess={() => { setEditing(null); mutate(`/api/materials?${qs}`) }}
          onClose={() => setEditing(null)}
        />
      )}

      {movement && (
        <MovementForm
          material={movement}
          onSuccess={() => { setMovement(null); mutate(`/api/materials?${qs}`) }}
          onClose={() => setMovement(null)}
        />
      )}
    </div>
  )
}

// ─── Material Form ───────────────────────────────────────────
function MaterialForm({ initial, onSuccess, onClose }: { initial?: Material; onSuccess: () => void; onClose: () => void }) {
  const [v, setV] = useState({
    name:           initial?.name           ?? '',
    material_code:  initial?.material_code  ?? '',
    category:       initial?.category       ?? '',
    unit:           initial?.unit           ?? 'ชิ้น',
    unit_cost:      initial?.unit_cost      ?? 0,
    unit_price:     initial?.unit_price     ?? 0,
    stock_qty:      initial?.stock_qty      ?? 0,
    min_stock:      initial?.min_stock      ?? 0,
    supplier:       initial?.supplier       ?? '',
    description:    initial?.description    ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!v.name.trim()) return toast.error('กรุณากรอกชื่อวัสดุ')
    setSaving(true)
    try {
      const url    = initial ? `/api/materials/${initial.id}` : '/api/materials'
      const method = initial ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(initial ? 'อัปเดตแล้ว' : 'เพิ่มวัสดุแล้ว')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="font-black">{initial ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุใหม่'}</h2>
          <button onClick={onClose} className="p-1"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <F label="ชื่อวัสดุ *"><input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} className="input"/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="รหัส"><input value={v.material_code} onChange={e => setV({ ...v, material_code: e.target.value })} className="input"/></F>
            <F label="หน่วย"><input value={v.unit} onChange={e => setV({ ...v, unit: e.target.value })} className="input" placeholder="ชิ้น/ม./กก."/></F>
          </div>
          <F label="หมวด">
            <select value={v.category} onChange={e => setV({ ...v, category: e.target.value })} className="input">
              <option value="">เลือก</option>
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="ต้นทุน/หน่วย (฿)"><input type="number" min="0" step="0.01" value={v.unit_cost} onChange={e => setV({ ...v, unit_cost: Number(e.target.value) })} className="input"/></F>
            <F label="ราคาขาย/หน่วย (฿)"><input type="number" min="0" step="0.01" value={v.unit_price} onChange={e => setV({ ...v, unit_price: Number(e.target.value) })} className="input"/></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="คงเหลือเริ่มต้น"><input type="number" min="0" value={v.stock_qty} onChange={e => setV({ ...v, stock_qty: Number(e.target.value) })} className="input" disabled={!!initial}/></F>
            <F label="แจ้งเตือนเมื่อต่ำกว่า"><input type="number" min="0" value={v.min_stock} onChange={e => setV({ ...v, min_stock: Number(e.target.value) })} className="input"/></F>
          </div>
          <F label="ผู้ขาย/แหล่ง"><input value={v.supplier} onChange={e => setV({ ...v, supplier: e.target.value })} className="input"/></F>
          <F label="รายละเอียด"><textarea value={v.description} onChange={e => setV({ ...v, description: e.target.value })} rows={2} className="input resize-none"/></F>
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

// ─── Movement Form (in/out/adjustment) ───────────────────────
function MovementForm({ material, onSuccess, onClose }: { material: Material; onSuccess: () => void; onClose: () => void }) {
  const [kind, setKind] = useState<'in'|'out'|'adjustment'>('in')
  const [qty, setQty]   = useState(0)
  const [cost, setCost] = useState(material.unit_cost)
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (qty <= 0) return toast.error('จำนวนต้องมากกว่า 0')
    setSaving(true)
    try {
      const res  = await fetch('/api/materials/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: material.id,
          kind, quantity: qty,
          unit_cost: cost,
          note, reference,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(`บันทึก${KIND_LABEL[kind].label} ${qty} ${material.unit} แล้ว`)
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h2 className="font-black">เคลื่อนไหวสต๊อก</h2>
            <div className="text-xs text-gray-500">{material.name} · คงเหลือ {Number(material.stock_qty).toLocaleString()} {material.unit}</div>
          </div>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(['in','out','adjustment'] as const).map(k => (
              <button key={k} onClick={() => setKind(k)}
                className={`p-3 rounded-xl border-2 ${kind === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <div className="font-bold text-sm">{KIND_LABEL[k].label}</div>
              </button>
            ))}
          </div>
          <F label={`จำนวน (${material.unit})`}>
            <input type="number" min="0" step="0.01" value={qty} onChange={e => setQty(Number(e.target.value))} className="input font-bold text-lg"/>
          </F>
          {kind === 'in' && (
            <F label="ต้นทุน/หน่วย (฿)">
              <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(Number(e.target.value))} className="input"/>
            </F>
          )}
          <F label="เลขที่อ้างอิง"><input value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="เลขใบเสร็จ/ใบส่งของ"/></F>
          <F label="หมายเหตุ"><input value={note} onChange={e => setNote(e.target.value)} className="input"/></F>

          {qty > 0 && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">คงเหลือใหม่:</span>
                <b className="text-blue-700">
                  {(Number(material.stock_qty) + (kind === 'in' ? qty : kind === 'out' ? -qty : qty)).toLocaleString()} {material.unit}
                </b>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={save} disabled={saving || qty <= 0} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : 'บันทึก'}
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

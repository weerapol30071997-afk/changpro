'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { Calendar, Plus, X, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Holiday } from '@/types/enterprise'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const TYPE_LABEL = {
  public:     { label: 'เธเธฑเธเธเธฑเธ•เธคเธเธฉเน', color: 'bg-red-100 text-red-700' },
  company:    { label: 'เธเธฃเธดเธฉเธฑเธ—',    color: 'bg-blue-100 text-blue-700' },
  religious:  { label: 'เธจเธฒเธชเธเธฒ',     color: 'bg-purple-100 text-purple-700' },
  substitute: { label: 'เธเธ”เน€เธเธข',     color: 'bg-amber-100 text-amber-700' },
}

export default function HolidaysPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const { data: holidays = [] } = useSWR<Holiday[]>(`/api/holidays?year=${year}`, fetcher)

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date))
  const upcoming = sorted.filter(h => new Date(h.date) >= new Date())
  const past     = sorted.filter(h => new Date(h.date) < new Date())

  async function remove(id: string) {
    if (!confirm('เธฅเธเธงเธฑเธเธซเธขเธธเธ”เธเธตเน?')) return
    try {
      const res  = await fetch(`/api/holidays/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('เธฅเธเนเธฅเนเธง')
      mutate(`/api/holidays?year=${year}`)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">เธงเธฑเธเธซเธขเธธเธ”เธเธฃเธฐเธเธณเธเธต</h1>
          <p className="text-sm text-gray-500">เนเธเนเธเธณเธเธงเธ“ OT เธเธดเน€เธจเธฉ + เธฅเธฒเธงเธฑเธเธซเธขเธธเธ”</p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-28">
            {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={18}/> เน€เธเธดเนเธก</button>
        </div>
      </div>

      {/* Upcoming */}
      <div className="card p-4 mb-4">
        <div className="font-bold text-sm mb-3 flex items-center gap-2">
          <Calendar size={16} className="text-blue-600"/>
          เธงเธฑเธเธซเธขเธธเธ”เธ—เธตเนเธเธณเธฅเธฑเธเธเธฐเธกเธฒเธ–เธถเธ ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">เนเธกเนเธกเธตเธงเธฑเธเธซเธขเธธเธ”เน€เธซเธฅเธทเธญเนเธเธเธตเธเธตเน</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(h => {
              const t = TYPE_LABEL[(h as any).type as keyof typeof TYPE_LABEL] ?? TYPE_LABEL.public
              const daysUntil = Math.ceil((new Date(h.date).getTime() - Date.now()) / 86400000)
              return (
                <div key={h.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-12 text-center shrink-0">
                    <div className="text-[10px] text-gray-500">{format(new Date(h.date), 'MMM', { locale: th })}</div>
                    <div className="font-black text-lg">{format(new Date(h.date), 'd')}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{h.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.color}`}>
                        {t.label}
                      </span>
                      {h.is_paid && (
                        <span className="text-[10px] text-green-700">๐’ฐ เธซเธขเธธเธ”เธกเธตเธเนเธฒเธเนเธฒเธ</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0">
                    {daysUntil === 0 ? 'เธงเธฑเธเธเธตเน' : daysUntil === 1 ? 'เธเธฃเธธเนเธเธเธตเน' : `เธญเธตเธ ${daysUntil} เธงเธฑเธ`}
                  </span>
                  <button onClick={() => remove(h.id)} className="text-gray-400 hover:text-red-500 p-1">
                    <Trash2 size={14}/>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <details className="card p-4">
          <summary className="font-bold text-sm cursor-pointer text-gray-600">
            เธงเธฑเธเธซเธขเธธเธ”เธ—เธตเนเธเนเธฒเธเธกเธฒ ({past.length})
          </summary>
          <div className="space-y-1 mt-3 opacity-60">
            {past.reverse().map(h => (
              <div key={h.id} className="text-xs text-gray-500 flex items-center justify-between py-1">
                <span>{format(new Date(h.date), 'd MMM yyyy', { locale: th })}</span>
                <span>{h.name}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {showForm && (
        <HolidayForm
          onSuccess={() => { setShowForm(false); mutate(`/api/holidays?year=${year}`) }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function HolidayForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'public'|'company'|'religious'|'substitute'>('public')
  const [isPaid, setIsPaid] = useState(true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!date || !name.trim()) return toast.error('เธเธฃเธญเธเธเนเธญเธกเธนเธฅเนเธซเนเธเธฃเธ')
    setSaving(true)
    try {
      const res  = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name, type, is_paid: isPaid }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('เน€เธเธดเนเธกเธงเธฑเธเธซเธขเธธเธ”เนเธฅเนเธง')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-black">เน€เธเธดเนเธกเธงเธฑเธเธซเธขเธธเธ”</h2>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">เธงเธฑเธเธ—เธตเน *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">เธเธทเนเธญเธงเธฑเธเธซเธขเธธเธ” *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input"
              placeholder="เน€เธเนเธ เธงเธฑเธเธชเธเธเธฃเธฒเธเธ•เน"/>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">เธเธฃเธฐเน€เธ เธ—</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <label key={k} className={`flex items-center gap-2 p-2 rounded-xl border-2 cursor-pointer ${
                  type === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <input type="radio" value={k} checked={type === k}
                    onChange={() => setType(k as any)} className="text-blue-600"/>
                  <span className="text-xs font-semibold">{v.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
            ${isPaid ? 'border-green-400 bg-green-50' : 'border-gray-200'}">
            <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="w-5 h-5"/>
            <span className="text-sm font-bold">เธซเธขเธธเธ”เธกเธตเธเนเธฒเธเนเธฒเธ</span>
          </label>
        </div>
        <div className="px-4 py-3 border-t flex gap-2">
          <button onClick={onClose} className="flex-1 btn-ghost">เธขเธเน€เธฅเธดเธ</button>
          <button onClick={save} disabled={saving} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : '๐’พ'} เธเธฑเธเธ—เธถเธ
          </button>
        </div>
      </div>
    </div>
  )
}

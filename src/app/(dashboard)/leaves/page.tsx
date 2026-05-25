'use client'
import { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { format, differenceInDays } from 'date-fns'
import { th } from 'date-fns/locale'
import { Plus, Calendar, X, Loader2, Check, AlertCircle } from 'lucide-react'
import type { LeaveRequest, LeaveKind } from '@/types/enterprise'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const KIND_LABEL: Record<LeaveKind, { label: string; emoji: string; cls: string }> = {
  vacation:    { label: 'ลาพักร้อน',    emoji: '🏖', cls: 'bg-blue-100 text-blue-700' },
  sick:        { label: 'ลาป่วย',        emoji: '🤒', cls: 'bg-red-100 text-red-700' },
  personal:    { label: 'ลากิจ',          emoji: '📋', cls: 'bg-amber-100 text-amber-700' },
  maternity:   { label: 'ลาคลอด',        emoji: '👶', cls: 'bg-pink-100 text-pink-700' },
  bereavement: { label: 'ลาเพื่องานศพ',  emoji: '🕯', cls: 'bg-gray-200 text-gray-700' },
  unpaid:      { label: 'ลาไม่รับเงิน',  emoji: '💸', cls: 'bg-gray-100 text-gray-600' },
  other:       { label: 'อื่นๆ',          emoji: '📝', cls: 'bg-purple-100 text-purple-700' },
}

const STATUS_STYLES = {
  pending:   { label: 'รออนุมัติ', cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: 'อนุมัติ',   cls: 'bg-green-100 text-green-700' },
  rejected:  { label: 'ปฏิเสธ',    cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ยกเลิก',    cls: 'bg-gray-100 text-gray-500' },
}

export default function LeavesPage() {
  const [tab, setTab] = useState<'all'|'pending'|'approved'|'rejected'>('all')
  const [showForm, setShowForm] = useState(false)
  const [me, setMe] = useState<any>(null)

  useEffect(() => { fetch('/api/profile').then(r => r.json()).then(j => { if (j.ok) setMe(j.data) }).catch(()=>{}) }, [])
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const url = tab === 'all' ? '/api/leaves' : `/api/leaves?status=${tab}`
  const { data: leaves = [] } = useSWR<LeaveRequest[]>(url, fetcher)

  const counts: any = { all: leaves.length }
  for (const l of leaves) counts[l.status] = (counts[l.status] || 0) + 1

  async function review(id: string, status: 'approved'|'rejected', note?: string) {
    try {
      const res = await fetch(`/api/leaves/${id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
      mutate(url)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">การลา</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'จัดการคำขอลาของพนักงาน' : 'คำขอลาของฉัน'}
          </p>
        </div>
        {!isAdmin && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus size={18}/> ขอลา
          </button>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(['all','pending','approved','rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
            }`}>
            {t === 'all' ? 'ทั้งหมด' : STATUS_STYLES[t].label} ({counts[t] ?? 0})
          </button>
        ))}
      </div>

      {leaves.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-40"/>
          <p>ยังไม่มีคำขอลา</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leaves.map(l => {
            const kind   = KIND_LABEL[l.kind]
            const status = STATUS_STYLES[l.status as keyof typeof STATUS_STYLES]
            return (
              <div key={l.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{kind.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && l.employee && (
                        <span className="font-bold text-sm">{l.employee.full_name}</span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${kind.cls}`}>
                        {kind.label}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {format(new Date(l.start_date), 'd MMM', { locale: th })} —
                      {format(new Date(l.end_date), ' d MMM yyyy', { locale: th })}
                      <b className="text-gray-900"> ({l.total_days} วัน)</b>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">{l.reason}</div>
                    {l.review_note && (
                      <div className={`text-xs mt-2 rounded-lg p-2 ${
                        l.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        💬 {l.review_note}
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && l.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <button onClick={() => {
                      const note = prompt('เหตุผลที่ปฏิเสธ:') ?? undefined
                      if (note) review(l.id, 'rejected', note)
                    }} className="flex-1 btn-ghost text-xs text-red-600">
                      <X size={12}/> ปฏิเสธ
                    </button>
                    <button onClick={() => review(l.id, 'approved')}
                      className="flex-1 btn-success text-xs">
                      <Check size={12}/> อนุมัติ
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showForm && <LeaveForm onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); mutate(url) }}/>}
    </div>
  )
}

function LeaveForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const form = useForm<any>({
    defaultValues: {
      kind: 'vacation',
      start_date: '',
      end_date: '',
      reason: '',
    },
  })
  const v = form.watch()
  const days = v.start_date && v.end_date ? differenceInDays(new Date(v.end_date), new Date(v.start_date)) + 1 : 0

  async function submit(data: any) {
    if (days <= 0) return toast.error('วันที่ไม่ถูกต้อง')
    setSaving(true)
    try {
      const res  = await fetch('/api/leaves', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('ส่งคำขอลาแล้ว — รออนุมัติ')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <form onSubmit={form.handleSubmit(submit)}
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl slide-up" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex justify-between">
          <div className="font-black">📋 ขอลา</div>
          <button type="button" onClick={onClose} className="text-gray-400"><X size={20}/></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">ประเภทการลา</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(KIND_LABEL) as LeaveKind[]).map(k => (
                <label key={k} className={`flex flex-col items-center p-2 rounded-xl border-2 cursor-pointer ${
                  v.kind === k ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <input type="radio" {...form.register('kind')} value={k} className="sr-only"/>
                  <span className="text-2xl">{KIND_LABEL[k].emoji}</span>
                  <span className="text-[10px] font-bold mt-1 text-center">{KIND_LABEL[k].label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">วันที่เริ่มลา</label>
              <input type="date" {...form.register('start_date', { required: true })} className="input"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">วันที่สิ้นสุด</label>
              <input type="date" {...form.register('end_date', { required: true })} className="input"/>
            </div>
          </div>

          {days > 0 && (
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-600">รวมทั้งหมด</div>
              <div className="text-2xl font-black text-blue-700">{days} วัน</div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">เหตุผล *</label>
            <textarea {...form.register('reason', { required: true })} rows={3} className="input resize-none"
              placeholder="กรุณาระบุเหตุผลและรายละเอียด..."/>
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
          <button type="submit" disabled={saving} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : '✉️'} ส่งคำขอ
          </button>
        </div>
      </form>
    </div>
  )
}

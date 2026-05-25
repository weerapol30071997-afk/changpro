'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { Plus, Check, DollarSign, FileText, Trash2, Edit2 } from 'lucide-react'
import { PayrollBuilder } from '@/components/payroll/PayrollBuilder'
import type { EmployeeExtended } from '@/types/employee'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n)
const curMonth = () => format(new Date(), 'yyyy-MM')

const PT_LABEL = { daily: 'รายวัน', monthly: 'รายเดือน', hourly: 'รายชั่วโมง' } as const
const PT_COLOR = {
  daily:   'bg-amber-100 text-amber-700',
  monthly: 'bg-blue-100 text-blue-700',
  hourly:  'bg-purple-100 text-purple-700',
} as const

const STATUS_STYLES = {
  draft:    { label: 'แบบร่าง',  bg: 'bg-gray-100',  text: 'text-gray-600' },
  approved: { label: 'อนุมัติ', bg: 'bg-blue-100',   text: 'text-blue-700' },
  paid:     { label: 'จ่ายแล้ว', bg: 'bg-green-100', text: 'text-green-700' },
} as const

export default function SalaryPage() {
  const [month, setMonth] = useState(curMonth())
  const [builder, setBuilder] = useState<{ employee: EmployeeExtended; existing?: any } | null>(null)
  const [tab, setTab] = useState<'all'|'draft'|'approved'|'paid'>('all')

  const { data: employees = [] } = useSWR<EmployeeExtended[]>('/api/employees', fetcher)
  const { data: payrollData }    = useSWR(`/api/payroll?month=${month}`, fetcher)
  const periods = payrollData?.periods ?? []

  const filtered    = tab === 'all' ? periods : periods.filter((p: any) => p.status === tab)
  const unpaidEmps  = employees.filter(e => !periods.find((p: any) => p.employee_id === e.id))
  const totalNet    = periods.reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0)
  const totalPaid   = periods.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0)
  const totalPending= periods.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + Number(p.net_amount || 0), 0)

  async function action(id: string, kind: 'approve'|'pay'|'delete') {
    try {
      const url    = kind === 'delete' ? `/api/payroll/${id}` : `/api/payroll/${id}/${kind}`
      const method = kind === 'delete' ? 'DELETE' : 'POST'
      const res    = await fetch(url, { method })
      const json   = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(kind === 'approve' ? 'อนุมัติแล้ว' : kind === 'pay' ? 'บันทึกจ่ายเงินแล้ว' : 'ลบแล้ว')
      mutate(`/api/payroll?month=${month}`)
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">เงินเดือน</h1>
          <p className="text-sm text-gray-500">คำนวณตามวันที่จริง · รองรับรายวัน/รายเดือน/รายชั่วโมง</p>
        </div>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-40"/>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCard icon="📄" label="สลิปทั้งหมด" value={periods.length} color="text-blue-600"/>
        <StatCard icon="✅" label="จ่ายแล้ว"    value={`${thbN(totalPaid)} ฿`}    color="text-green-600" small/>
        <StatCard icon="⏳" label="ค้างจ่าย"    value={`${thbN(totalPending)} ฿`} color="text-amber-600" small/>
      </div>

      {periods.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 text-white"
          style={{ background: 'linear-gradient(135deg,#0a0f1e,#1a3a8f)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-white/60">ยอดรวม {format(new Date(month+'-01'), 'MMMM yyyy', { locale: th })}</div>
              <div className="text-2xl font-black mt-1">{thbN(totalNet)} ฿</div>
              <div className="text-xs text-white/70 mt-0.5">{periods.length} คน</div>
            </div>
            <DollarSign size={48} className="text-white/30"/>
          </div>
        </div>
      )}

      {unpaidEmps.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="font-bold text-sm mb-3 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-700 rounded-md px-2 py-0.5 text-[10px]">NEW</span>
            สร้างสลิปสำหรับ {format(new Date(month+'-01'), 'MMMM', { locale: th })}
          </div>
          <div className="flex flex-wrap gap-2">
            {unpaidEmps.map(e => (
              <button key={e.id} onClick={() => setBuilder({ employee: e })}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-2 border-blue-200 rounded-xl
                  text-blue-700 text-xs font-bold hover:bg-blue-100">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                  {e.full_name[0]}
                </div>
                {e.full_name}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${PT_COLOR[e.payment_type]}`}>
                  {PT_LABEL[e.payment_type]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {(['all','draft','approved','paid'] as const).map(t => {
          const cnt   = t === 'all' ? periods.length : periods.filter((p: any) => p.status === t).length
          const label = t === 'all' ? 'ทั้งหมด' : STATUS_STYLES[t].label
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {label} <span className="opacity-70">({cnt})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-3 opacity-40"/>
          <p>ยังไม่มีสลิป</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p: any) => {
            const s = STATUS_STYLES[p.status as keyof typeof STATUS_STYLES]
            const employee = employees.find(e => e.id === p.employee_id)
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                    flex items-center justify-center text-white font-black shrink-0">
                    {p.employee?.full_name?.[0] ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{p.employee?.full_name}</span>
                      {p.payment_type && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PT_COLOR[p.payment_type as keyof typeof PT_COLOR]}`}>
                          {PT_LABEL[p.payment_type as keyof typeof PT_LABEL]}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      งวด {format(new Date(p.period_from), 'd MMM', { locale: th })} —
                      {format(new Date(p.period_to), ' d MMM', { locale: th })}
                      {' · '}จ่าย {format(new Date(p.pay_date), 'd MMM', { locale: th })}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <span><b>{p.work_days}</b> วัน</span>
                      <span className="text-gray-400">·</span>
                      <span><b className="text-amber-600">{Number(p.ot_hours).toFixed(1)}</b> ชม. OT</span>
                      <span className="text-gray-400">·</span>
                      <span>Gross <b>{thbN(Number(p.gross_amount))}</b></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-black text-blue-700">{thbN(Number(p.net_amount))}</div>
                    <div className="text-[10px] text-gray-400">฿</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t">
                  {p.status === 'draft' && (
                    <>
                      <button onClick={() => setBuilder({ employee: employee!, existing: p })}
                        className="flex-1 btn-ghost text-xs"><Edit2 size={12}/> แก้ไข</button>
                      <button onClick={() => action(p.id, 'approve')}
                        className="flex-1 btn-primary text-xs"><Check size={12}/> อนุมัติ</button>
                      <button onClick={() => action(p.id, 'delete')}
                        className="btn-ghost text-xs text-red-500"><Trash2 size={12}/></button>
                    </>
                  )}
                  {p.status === 'approved' && (
                    <button onClick={() => action(p.id, 'pay')}
                      className="flex-1 btn-success text-xs"><DollarSign size={12}/> จ่ายเงิน</button>
                  )}
                  {p.status === 'paid' && (
                    <div className="text-xs text-gray-500 flex items-center gap-2 px-2">
                      ✅ จ่ายเมื่อ {format(new Date(p.paid_at), 'd MMM HH:mm', { locale: th })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {builder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setBuilder(null)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl slide-up" onClick={e => e.stopPropagation()}>
            <PayrollBuilder
              employee={builder.employee}
              existing={builder.existing}
              onSuccess={() => { setBuilder(null); mutate(`/api/payroll?month=${month}`) }}
              onClose={() => setBuilder(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color, small }: any) {
  return (
    <div className="card p-3">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className={`font-black ${small ? 'text-sm' : 'text-xl'} ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

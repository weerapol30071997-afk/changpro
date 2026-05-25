'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Loader2, Save, Building2, Clock, DollarSign, MapPin } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const DAYS = [
  { v: 1, label: 'จ' }, { v: 2, label: 'อ' }, { v: 3, label: 'พ' },
  { v: 4, label: 'พฤ' }, { v: 5, label: 'ศ' }, { v: 6, label: 'ส' }, { v: 0, label: 'อา' },
]

export default function SettingsPage() {
  const { data: org } = useSWR('/api/org', fetcher)
  const [v, setV] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (org && !v) setV(org) }, [org, v])

  if (!v) return <div className="card p-12 text-center"><Loader2 className="animate-spin mx-auto"/></div>

  function toggleDay(d: number) {
    const ww: number[] = v.workweek ?? [1,2,3,4,5]
    setV({ ...v, workweek: ww.includes(d) ? ww.filter(x => x !== d) : [...ww, d].sort() })
  }

  async function save() {
    setSaving(true)
    try {
      const res  = await fetch('/api/org', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('บันทึกแล้ว')
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">ตั้งค่า</h1>
          <p className="text-sm text-gray-500">ข้อมูลบริษัท · เวลาทำงาน · OT · สกุลเงิน</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
          บันทึก
        </button>
      </div>

      <div className="space-y-4">
        {/* Company info */}
        <Section icon={Building2} title="ข้อมูลบริษัท">
          <F label="ชื่อบริษัท"><input value={v.name ?? ''} onChange={e => setV({ ...v, name: e.target.value })} className="input"/></F>
          <F label="ชื่อจดทะเบียน"><input value={v.legal_name ?? ''} onChange={e => setV({ ...v, legal_name: e.target.value })} className="input"/></F>
          <div className="grid grid-cols-2 gap-3">
            <F label="เลขผู้เสียภาษี"><input value={v.tax_id ?? ''} onChange={e => setV({ ...v, tax_id: e.target.value })} className="input"/></F>
            <F label="เบอร์โทร"><input value={v.phone ?? ''} onChange={e => setV({ ...v, phone: e.target.value })} className="input"/></F>
          </div>
          <F label="อีเมล"><input type="email" value={v.email ?? ''} onChange={e => setV({ ...v, email: e.target.value })} className="input"/></F>
          <F label="ที่อยู่"><textarea value={v.address ?? ''} onChange={e => setV({ ...v, address: e.target.value })} rows={2} className="input resize-none"/></F>
        </Section>

        {/* Work hours */}
        <Section icon={Clock} title="เวลาทำงาน">
          <div className="grid grid-cols-2 gap-3">
            <F label="เวลาเริ่มงาน"><input type="time" value={v.work_start_time ?? '08:00'} onChange={e => setV({ ...v, work_start_time: e.target.value })} className="input"/></F>
            <F label="เวลาเลิกงาน"><input type="time" value={v.work_end_time ?? '17:00'} onChange={e => setV({ ...v, work_end_time: e.target.value })} className="input"/></F>
          </div>
          <F label="พักกลางวัน (นาที)"><input type="number" min="0" value={v.break_minutes ?? 60} onChange={e => setV({ ...v, break_minutes: Number(e.target.value) })} className="input"/></F>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-2">วันทำงาน</label>
            <div className="flex gap-1.5">
              {DAYS.map(d => {
                const on = (v.workweek ?? [1,2,3,4,5]).includes(d.v)
                return (
                  <button key={d.v} type="button" onClick={() => toggleDay(d.v)}
                    className={`w-12 h-12 rounded-xl font-black border-2 ${
                      on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'
                    }`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        {/* OT rates */}
        <Section icon={DollarSign} title="อัตราค่าล่วงเวลา (OT)">
          <div className="grid grid-cols-2 gap-3">
            <F label="OT วันหยุด (× เท่า)" hint="ตามกม. แรงงาน: 3 เท่า">
              <input type="number" step="0.5" min="1" max="5" value={v.holiday_ot_rate ?? 3}
                onChange={e => setV({ ...v, holiday_ot_rate: Number(e.target.value) })} className="input"/>
            </F>
            <F label="วันหยุดมีค่าจ้าง (× เท่า)" hint="ทำงานวันหยุด: 2 เท่า">
              <input type="number" step="0.5" min="1" max="5" value={v.holiday_pay_rate ?? 2}
                onChange={e => setV({ ...v, holiday_pay_rate: Number(e.target.value) })} className="input"/>
            </F>
          </div>
        </Section>

        {/* Locale */}
        <Section icon={MapPin} title="ภูมิภาค">
          <div className="grid grid-cols-2 gap-3">
            <F label="สกุลเงิน">
              <select value={v.currency ?? 'THB'} onChange={e => setV({ ...v, currency: e.target.value })} className="input">
                <option value="THB">฿ บาท (THB)</option>
                <option value="USD">$ ดอลลาร์ (USD)</option>
              </select>
            </F>
            <F label="เขตเวลา">
              <select value={v.timezone ?? 'Asia/Bangkok'} onChange={e => setV({ ...v, timezone: e.target.value })} className="input">
                <option value="Asia/Bangkok">เอเชีย/กรุงเทพ</option>
                <option value="Asia/Singapore">เอเชีย/สิงคโปร์</option>
              </select>
            </F>
          </div>
          <F label="บัญชีธนาคารสำหรับจ่ายเงินเดือน">
            <input value={v.bank_account_for_payroll ?? ''} onChange={e => setV({ ...v, bank_account_for_payroll: e.target.value })} className="input"/>
          </F>
        </Section>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, children }: any) {
  return (
    <div className="card p-4">
      <div className="font-bold text-sm mb-3 flex items-center gap-2 text-gray-700">
        <Icon size={16} className="text-blue-600"/> {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      {hint && <div className="text-[10px] text-gray-400 mb-1">{hint}</div>}
      {children}
    </div>
  )
}

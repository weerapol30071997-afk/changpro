'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { Plus, Search, Filter, Loader2 } from 'lucide-react'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import type { EmployeeExtended } from '@/types/employee'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH').format(n)

const PT_LABEL = { daily: 'รายวัน', monthly: 'รายเดือน', hourly: 'รายชั่วโมง' }
const PT_COLOR = {
  daily:   'bg-amber-100 text-amber-700',
  monthly: 'bg-blue-100 text-blue-700',
  hourly:  'bg-purple-100 text-purple-700',
}

export default function EmployeesPage() {
  const { data: employees = [], isLoading } = useSWR<EmployeeExtended[]>('/api/employees', fetcher)
  const [editing, setEditing] = useState<EmployeeExtended | 'new' | null>(null)
  const [search,  setSearch]  = useState('')
  const [filterPay, setFilterPay] = useState<string>('all')

  const filtered = employees.filter(e =>
    (filterPay === 'all' || e.payment_type === filterPay) &&
    (e.full_name.toLowerCase().includes(search.toLowerCase()) ||
     e.role.toLowerCase().includes(search.toLowerCase()) ||
     e.employee_code?.toLowerCase().includes(search.toLowerCase()))
  )

  function onSuccess() {
    setEditing(null)
    mutate('/api/employees')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">พนักงาน ({employees.length})</h1>
          <p className="text-sm text-gray-500">จัดการข้อมูล รายวัน · รายเดือน · รายชั่วโมง</p>
        </div>
        <button onClick={() => setEditing('new')} className="btn-primary"><Plus size={18}/> เพิ่ม</button>
      </div>

      <div className="card p-3 mb-3 flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ ตำแหน่ง รหัส..."
            className="input pl-9"/>
        </div>
        <select value={filterPay} onChange={e => setFilterPay(e.target.value)} className="input w-32 shrink-0">
          <option value="all">ทุกประเภท</option>
          <option value="monthly">รายเดือน</option>
          <option value="daily">รายวัน</option>
          <option value="hourly">รายชั่วโมง</option>
        </select>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center text-gray-400">
          <Loader2 className="mx-auto animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          {employees.length === 0 ? 'ยังไม่มีพนักงาน — กดเพิ่มเพื่อเริ่มต้น' : 'ไม่พบผู้ที่ตรงเงื่อนไข'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(e => (
            <button key={e.id} onClick={() => setEditing(e)}
              className="card p-4 w-full text-left hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                  flex items-center justify-center text-white font-black text-lg shrink-0">
                  {e.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{e.full_name}</span>
                    {e.nickname && <span className="text-[11px] text-gray-500">({e.nickname})</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PT_COLOR[e.payment_type]}`}>
                      {PT_LABEL[e.payment_type]}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {e.role} {e.department ? `· ${e.department}` : ''}
                    {e.phone ? ` · ${e.phone}` : ''}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs">
                    <span className="font-bold text-blue-700">
                      {thbN(e.base_salary)} ฿
                      <span className="text-gray-400 font-normal">
                        /{e.payment_type === 'daily' ? 'วัน' : e.payment_type === 'hourly' ? 'ชม.' : 'เดือน'}
                      </span>
                    </span>
                    {e.bank_name && (
                      <span className="text-gray-500 truncate">
                        🏦 {e.bank_name}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  e.status === 'active' ? 'bg-green-100 text-green-700'
                  : e.status === 'leave' ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
                }`}>
                  {e.status === 'active' ? 'ทำงาน' : e.status === 'leave' ? 'ลา' : e.status === 'off' ? 'หยุด' : 'ลาออก'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setEditing(null)}>
          <div className="w-full max-w-2xl mx-auto bg-white rounded-t-3xl slide-up" onClick={e => e.stopPropagation()}>
            <EmployeeForm
              initial={editing === 'new' ? undefined : editing}
              onSuccess={onSuccess}
              onClose={() => setEditing(null)}/>
          </div>
        </div>
      )}
    </div>
  )
}

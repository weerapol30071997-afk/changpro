'use client'
/**
 * AssignDialog — quick picker to assign/reassign a job to a specific employee.
 * - Search by name/role
 * - Shows current workload per employee (jobs in progress)
 * - One tap to assign, sends notification automatically
 */
import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  X, Search, Check, UserX, Loader2, Briefcase,
} from 'lucide-react'
import type { EmployeeExtended } from '@/types/employee'
import type { JobExtended } from '@/lib/repositories/jobs'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

type Props = {
  job:       JobExtended
  onSuccess: (updated: JobExtended) => void
  onClose:   () => void
}

export function AssignDialog({ job, onSuccess, onClose }: Props) {
  const { data: employees = [] } = useSWR<EmployeeExtended[]>('/api/employees', fetcher)
  const { data: allJobs = [] }   = useSWR<JobExtended[]>('/api/jobs', fetcher)
  const [search,   setSearch]   = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const active = employees.filter(e => e.status === 'active')
  const filtered = active.filter(e =>
    !search ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.nickname?.toLowerCase().includes(search.toLowerCase())
  )

  // Workload calculation per employee
  const workload = (empId: string) => allJobs.filter(j =>
    j.assigned_to === empId &&
    ['pending','inprogress','awaiting_inspection','rejected'].includes(j.status)
  ).length

  async function pick(employee_id: string | null) {
    setLoadingId(employee_id ?? 'unassign')
    try {
      const res = await fetch(`/api/jobs/${job.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)

      toast.success(
        employee_id
          ? `มอบหมายให้ ${active.find(e => e.id === employee_id)?.full_name} เรียบร้อย`
          : 'ยกเลิกการมอบหมายแล้ว'
      )
      onSuccess(json.data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[88dvh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div>
            <div className="font-black">มอบหมายงาน</div>
            <div className="text-xs text-gray-500 truncate">{job.title}</div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20}/></button>
        </div>

        {/* Current assignee banner */}
        {job.employee && (
          <div className="px-4 py-3 bg-blue-50 border-b flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black
              flex items-center justify-center text-sm">
              {job.employee.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-blue-700 font-bold">ผู้รับผิดชอบปัจจุบัน</div>
              <div className="font-bold text-sm">{job.employee.full_name}</div>
              <div className="text-[11px] text-gray-500">{job.employee.role}</div>
            </div>
            <button onClick={() => pick(null)} disabled={loadingId !== null}
              className="text-xs bg-white border border-red-300 text-red-600 rounded-full px-3 py-1.5 font-bold
                flex items-center gap-1">
              {loadingId === 'unassign' ? <Loader2 className="animate-spin" size={12}/> : <UserX size={12}/>}
              ยกเลิก
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3 border-b shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาช่าง..." className="input pl-9"/>
          </div>
        </div>

        {/* Employee list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <UserX size={36} className="mx-auto mb-3 opacity-40"/>
              <p className="text-sm">ไม่พบช่างที่ตรงเงื่อนไข</p>
            </div>
          )}

          {filtered.map(emp => {
            const isCurrent = job.assigned_to === emp.id
            const load = workload(emp.id)
            const isLoading = loadingId === emp.id

            return (
              <button key={emp.id} onClick={() => !isCurrent && pick(emp.id)}
                disabled={isCurrent || loadingId !== null}
                className={`w-full p-4 border-b text-left flex items-center gap-3 transition-colors
                  ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  ${loadingId !== null && !isLoading ? 'opacity-40' : ''}`}>

                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                    text-white font-black flex items-center justify-center text-lg">
                    {emp.full_name[0]}
                  </div>
                  {isCurrent && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-600
                      border-2 border-white flex items-center justify-center">
                      <Check size={12} className="text-white"/>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">
                    {emp.full_name}
                    {emp.nickname && <span className="text-gray-500 font-normal"> ({emp.nickname})</span>}
                  </div>
                  <div className="text-xs text-gray-500">{emp.role}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1
                      ${load === 0 ? 'bg-green-100 text-green-700'
                       : load <= 2 ? 'bg-blue-100 text-blue-700'
                       :              'bg-amber-100 text-amber-700'}`}>
                      <Briefcase size={10}/>
                      {load === 0 ? 'ว่าง' : `${load} งานค้าง`}
                    </span>
                    {emp.skills?.length > 0 && (
                      <span className="text-[10px] text-gray-500 truncate">
                        🏷 {emp.skills.slice(0,2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isLoading ? <Loader2 className="animate-spin text-blue-600" size={18}/> :
                   isCurrent ? <span className="text-[10px] font-bold text-blue-700">ปัจจุบัน</span> :
                               <span className="text-blue-600 text-xs font-bold">มอบหมาย →</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer warning */}
        {job.assigned_to && !['pending','rejected'].includes(job.status) && (
          <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-800 shrink-0">
            ⚠️ งานนี้กำลังดำเนินการอยู่ — ไม่สามารถเปลี่ยนช่างได้จนกว่าจะเสร็จหรือยกเลิก
          </div>
        )}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { Plus, Search, Wrench, AlertTriangle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { JobForm } from '@/components/jobs/JobForm'
import { JobDetail } from '@/components/jobs/JobDetail'
import { AssignDialog } from '@/components/jobs/AssignDialog'
import type { JobExtended } from '@/lib/repositories/jobs'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const STATUS_TABS = [
  { id: 'all',                  label: 'ทั้งหมด' },
  { id: 'pending',              label: 'รอเริ่ม',   color: 'text-gray-600' },
  { id: 'inprogress',           label: 'กำลังทำ',  color: 'text-blue-600' },
  { id: 'awaiting_inspection', label: 'รอตรวจ',    color: 'text-amber-600' },
  { id: 'rejected',             label: 'ตีกลับ',    color: 'text-red-600' },
  { id: 'approved',             label: 'เสร็จ',      color: 'text-green-600' },
] as const

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:              { label: 'รอเริ่ม',   cls: 'bg-gray-100 text-gray-700' },
  inprogress:           { label: 'กำลังทำ',  cls: 'bg-blue-100 text-blue-700' },
  awaiting_inspection:  { label: 'รอตรวจ',    cls: 'bg-amber-100 text-amber-700' },
  approved:             { label: 'ผ่าน',       cls: 'bg-green-100 text-green-700' },
  rejected:             { label: 'ตีกลับ',     cls: 'bg-red-100 text-red-700' },
  done:                 { label: 'เสร็จ',       cls: 'bg-green-100 text-green-700' },
  cancelled:            { label: 'ยกเลิก',     cls: 'bg-gray-100 text-gray-500' },
}

const PRI_BADGE: Record<string, { icon: string; cls: string }> = {
  low:    { icon: '🟢', cls: 'bg-gray-50 text-gray-600' },
  normal: { icon: '🔵', cls: 'bg-blue-50 text-blue-600' },
  high:   { icon: '🟡', cls: 'bg-amber-50 text-amber-700' },
  urgent: { icon: '🔴', cls: 'bg-red-50 text-red-700' },
}

export default function JobsPage() {
  const [tab, setTab]       = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState<JobExtended | 'new' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<JobExtended | null>(null)
  const [me, setMe]         = useState<{ role: string; employee_id: string | null } | null>(null)

  // Get current user role
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(j => { if (j.ok) setMe(j.data) }).catch(() => {})
  }, [])
  const isAdmin = me?.role === 'admin' || me?.role === 'manager'

  const qs   = tab === 'all' ? '' : `?status=${tab}`
  const { data: jobs = [], mutate: refetch } = useSWR<JobExtended[]>(`/api/jobs${qs}`, fetcher)

  const filtered = jobs.filter(j =>
    !search ||
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.location?.toLowerCase().includes(search.toLowerCase()) ||
    j.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  // Count by status for tabs
  const counts: Record<string, number> = { all: jobs.length }
  for (const j of jobs) counts[j.status] = (counts[j.status] || 0) + 1

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">งาน</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'จัดการมอบหมายงาน · ตรวจงาน' : 'งานที่ได้รับมอบหมาย'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm('new')} className="btn-primary">
            <Plus size={18}/> สร้างงาน
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่องาน สถานที่ ลูกค้า..."
          className="input pl-9"/>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => {
          const active = tab === t.id
          const cnt = counts[t.id] || 0
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                active ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {t.label}
              <span className={`${active ? 'bg-white/25' : 'bg-gray-100'} rounded-full px-1.5 text-[10px]`}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {/* Awaiting inspection alert for admin */}
      {isAdmin && (counts.awaiting_inspection ?? 0) > 0 && tab !== 'awaiting_inspection' && (
        <button onClick={() => setTab('awaiting_inspection')}
          className="w-full mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 text-left">
          <AlertTriangle size={20} className="text-amber-600"/>
          <div className="flex-1">
            <div className="font-bold text-sm text-amber-900">
              มี {counts.awaiting_inspection} งานรอตรวจ
            </div>
            <div className="text-xs text-amber-700">กดเพื่อดู</div>
          </div>
          <ChevronRight size={16} className="text-amber-600"/>
        </button>
      )}

      {/* Unassigned jobs alert for admin */}
      {isAdmin && (() => {
        const unassigned = jobs.filter(j => !j.assigned_to && ['pending','rejected'].includes(j.status))
        if (unassigned.length === 0) return null
        return (
          <div className="card border-2 border-dashed border-purple-200 bg-purple-50/50 p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-sm text-purple-800 flex items-center gap-2">
                ⚡ มี {unassigned.length} งานรอมอบหมาย
              </div>
            </div>
            <div className="space-y-1.5">
              {unassigned.slice(0, 5).map(j => (
                <div key={j.id} className="flex items-center gap-2 bg-white rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{j.title}</div>
                    <div className="text-[10px] text-gray-500">{j.location ?? '—'}</div>
                  </div>
                  <button onClick={() => setAssignTarget(j)}
                    className="text-[11px] bg-purple-600 text-white font-bold rounded-full px-3 py-1.5
                      whitespace-nowrap shrink-0">
                    มอบหมาย
                  </button>
                </div>
              ))}
              {unassigned.length > 5 && (
                <div className="text-[10px] text-purple-700 text-center pt-1">
                  + อีก {unassigned.length - 5} งาน
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Wrench size={36} className="mx-auto mb-3 opacity-40"/>
          <p>{jobs.length === 0 ? 'ยังไม่มีงาน' : 'ไม่พบงานที่ตรงเงื่อนไข'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(j => {
            const status = STATUS_BADGE[j.status] ?? STATUS_BADGE.pending
            const pri    = PRI_BADGE[j.priority] ?? PRI_BADGE.normal
            // @ts-ignore
const hasIssue = (j.status as string) === 'rejected'


            return (
              <button key={j.id} onClick={() => setOpenId(j.id)}
                className={`card p-4 w-full text-left transition-colors hover:bg-gray-50
                  ${hasIssue ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${pri.cls}`}>
                    {pri.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-[10px] text-gray-400">{j.job_code}</div>
                    <div className="font-bold text-sm leading-tight">{j.title}</div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${status.cls}`}>
                        {status.label}
                      </span>
                      {j.rejection_count > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          ตีกลับ {j.rejection_count}×
                        </span>
                      )}
                      {j.before_photos.length > 0 && (
                        <span className="text-[10px] text-gray-500">📷 ก่อน {j.before_photos.length}</span>
                      )}
                      {j.after_photos.length > 0 && (
                        <span className="text-[10px] text-gray-500">📸 หลัง {j.after_photos.length}</span>
                      )}
                    </div>

                    <div className="text-[11px] text-gray-500 mt-1 truncate flex items-center gap-1.5">
                      {j.location && `📍 ${j.location}`}
                      {j.employee
                        ? <> · 👷 {j.employee.full_name}</>
                        : isAdmin && ['pending','rejected'].includes(j.status) && (
                          <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                            ⚠️ ยังไม่มอบหมาย
                          </span>
                        )}
                    </div>

                    {hasIssue && j.inspection_note && (
                      <div className="text-[11px] text-red-700 mt-1.5 bg-red-50 rounded-md px-2 py-1 line-clamp-2">
                        ❌ {j.inspection_note}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0 mt-2"/>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setShowForm(null)}>
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl slide-up" onClick={e => e.stopPropagation()}>
            <JobForm
              existing={showForm === 'new' ? undefined : showForm}
              onSuccess={() => { setShowForm(null); refetch() }}
              onClose={() => setShowForm(null)}
            />
          </div>
        </div>
      )}

      {/* Detail modal */}
      {openId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl slide-up" onClick={e => e.stopPropagation()}>
            <JobDetail
              jobId={openId}
              isAdmin={isAdmin}
              myEmployeeId={me?.employee_id ?? null}
              onClose={() => { setOpenId(null); refetch() }}
            />
          </div>
        </div>
      )}

      {/* Quick assign modal */}
      {assignTarget && isAdmin && (
        <AssignDialog
          job={assignTarget}
          onSuccess={() => { setAssignTarget(null); refetch() }}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </div>
  )
}

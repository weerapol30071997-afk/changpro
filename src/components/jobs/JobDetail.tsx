'use client'
/**
 * JobDetail — single-job view with full workflow:
 *   Pending      → [Tech] tap "เริ่มงาน" → upload BEFORE photos
 *   Inprogress   → [Tech] tap "ส่งตรวจ" → upload AFTER photos + summary
 *   Awaiting     → [Admin] tap "ผ่าน"/"ไม่ผ่าน" with reason
 *   Approved     → ✅ done
 *   Rejected     → [Tech] tap "เริ่มงานใหม่" — back to inprogress
 */
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  Play, Upload, Check, X, AlertTriangle, MapPin, Phone,
  Clock, User, FileText, Loader2, CheckCircle2, XCircle, RefreshCw, ChevronLeft,
} from 'lucide-react'
import { PhotoUploader } from './PhotoUploader'
import { AssignDialog } from './AssignDialog'
import type { JobExtended } from '@/lib/repositories/jobs'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const STATUS_CONFIG = {
  pending:             { label: 'รอเริ่มงาน',  color: 'bg-gray-100 text-gray-700',     icon: Clock },
  inprogress:          { label: 'กำลังทำ',     color: 'bg-blue-100 text-blue-700',     icon: Play },
  awaiting_inspection: { label: 'รอตรวจ',       color: 'bg-amber-100 text-amber-700',   icon: Upload },
  approved:            { label: 'ผ่านการตรวจ', color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  rejected:            { label: 'ไม่ผ่าน',      color: 'bg-red-100 text-red-700',       icon: XCircle },
  done:                { label: 'เสร็จ',         color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  cancelled:           { label: 'ยกเลิก',       color: 'bg-gray-100 text-gray-500',     icon: X },
}

const PRIORITY_CONFIG = {
  low:    { label: 'ไม่ด่วน', color: 'bg-gray-100 text-gray-700' },
  normal: { label: 'ปกติ',     color: 'bg-blue-100 text-blue-700' },
  high:   { label: 'ด่วน',     color: 'bg-amber-100 text-amber-700' },
  urgent: { label: 'ด่วนมาก',  color: 'bg-red-100 text-red-700' },
}

type Props = {
  jobId:   string
  isAdmin: boolean
  myEmployeeId: string | null
  onClose: () => void
}

export function JobDetail({ jobId, isAdmin, myEmployeeId, onClose }: Props) {
  const { data: job, isLoading } = useSWR<JobExtended>(`/api/jobs/${jobId}`, fetcher)
  const [action, setAction] = useState<null | 'start' | 'submit' | 'inspect' | 'assign'>(null)

  if (isLoading || !job)
    return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></div>

  const status     = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG]
  const priority   = PRIORITY_CONFIG[job.priority as keyof typeof PRIORITY_CONFIG]
  const isAssigned = job.assigned_to === myEmployeeId
  const StatusIcon = status.icon

  function reload() { mutate(`/api/jobs/${jobId}`); mutate(`/api/jobs`) }

  return (
    <div className="flex flex-col h-full max-h-[92dvh] bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0 flex items-center gap-2">
        <button onClick={onClose} className="p-2 -ml-2"><ChevronLeft size={20}/></button>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-gray-400">{job.job_code}</div>
          <div className="font-black text-sm truncate">{job.title}</div>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${priority.color}`}>
          {priority.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">

        {/* Status banner */}
        <div className={`px-4 py-3 ${status.color} flex items-center gap-3`}>
          <StatusIcon size={20}/>
          <div className="flex-1">
            <div className="font-bold text-sm">{status.label}</div>
            {job.status === 'rejected' && job.inspection_note && (
              <div className="text-xs mt-0.5 opacity-90">
                <strong>เหตุผล:</strong> {job.inspection_note}
              </div>
            )}
            {job.status === 'approved' && job.inspected_at && (
              <div className="text-[11px] opacity-75 mt-0.5">
                ตรวจผ่านเมื่อ {format(new Date(job.inspected_at), 'd MMM HH:mm', { locale: th })}
              </div>
            )}
          </div>
          {job.rejection_count > 0 && (
            <div className="text-[10px] bg-white/40 rounded-full px-2 py-1 font-bold">
              ถูกตีกลับ {job.rejection_count} ครั้ง
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3 border-b">
          {job.description && (
            <Info icon={<FileText size={14}/>} label="รายละเอียด">
              {job.description}
            </Info>
          )}

          {job.location && (
            <Info icon={<MapPin size={14}/>} label="สถานที่">{job.location}</Info>
          )}

          {(job.customer_name || job.customer_phone) && (
            <div className="bg-amber-50 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-bold text-amber-700">ลูกค้า</div>
              {job.customer_name  && <Info icon={<User size={14}/>}  label="">{job.customer_name}</Info>}
              {job.customer_phone && (
                <a href={`tel:${job.customer_phone}`}
                  className="flex items-center gap-2 text-sm text-blue-600 font-bold">
                  <Phone size={14}/> {job.customer_phone}
                </a>
              )}
              {job.customer_address && (
                <Info icon={<MapPin size={14}/>} label="">{job.customer_address}</Info>
              )}
            </div>
          )}

          {/* Assigned employee — admin can reassign */}
          {job.employee ? (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold
                flex items-center justify-center text-sm">
                {job.employee.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-blue-700 font-bold">ผู้รับผิดชอบ</div>
                <div className="font-bold text-sm">{job.employee.full_name}</div>
                <div className="text-[11px] text-gray-500">{job.employee.role}</div>
              </div>
              {isAdmin && ['pending','rejected'].includes(job.status) && (
                <button onClick={() => setAction('assign')}
                  className="text-xs bg-white border border-blue-300 text-blue-700 rounded-full
                    px-3 py-1.5 font-bold whitespace-nowrap">
                  เปลี่ยนช่าง
                </button>
              )}
            </div>
          ) : isAdmin ? (
            <button onClick={() => setAction('assign')}
              className="w-full flex items-center gap-3 bg-amber-50 border-2 border-dashed
                border-amber-300 rounded-xl p-3 text-left active:bg-amber-100">
              <div className="w-9 h-9 rounded-full bg-amber-200 text-amber-700
                flex items-center justify-center font-bold">
                <User size={18}/>
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm text-amber-900">ยังไม่ได้มอบหมาย</div>
                <div className="text-[11px] text-amber-700">กดเพื่อเลือกช่าง</div>
              </div>
              <span className="text-amber-700 font-bold text-xs">มอบหมาย →</span>
            </button>
          ) : null}

          {job.estimated_cost && (
            <div className="text-xs text-gray-500">
              💰 ราคาประมาณ <b className="text-gray-900">{Number(job.estimated_cost).toLocaleString()} ฿</b>
              {job.actual_cost && <> · ใช้จริง <b className="text-green-600">{Number(job.actual_cost).toLocaleString()} ฿</b></>}
            </div>
          )}
        </div>

        {/* BEFORE photos */}
        {job.before_photos.length > 0 && (
          <PhotoGrid title="📷 รูปก่อนทำงาน" photos={job.before_photos}
            timestamp={job.started_at}/>
        )}

        {/* AFTER photos */}
        {job.after_photos.length > 0 && (
          <PhotoGrid title="✨ รูปหลังทำงาน" photos={job.after_photos}
            timestamp={job.submitted_at}/>
        )}

        {/* Work summary */}
        {(job.work_summary || job.materials_used) && (
          <div className="p-4 space-y-2 border-t">
            {job.work_summary && (
              <Info icon={<FileText size={14}/>} label="สรุปงานที่ทำ">{job.work_summary}</Info>
            )}
            {job.materials_used && (
              <Info icon={<FileText size={14}/>} label="วัสดุที่ใช้">{job.materials_used}</Info>
            )}
            {job.labor_hours && (
              <div className="text-xs text-gray-500">⏱ ใช้เวลา {job.labor_hours} ชม.</div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div className="p-4 border-t">
          <div className="text-xs font-bold text-gray-700 mb-2">📋 ไทม์ไลน์</div>
          <div className="space-y-2 text-xs">
            <TimelineRow ts={job.created_at} label="สร้างงาน"/>
            {job.started_at      && <TimelineRow ts={job.started_at}      label="เริ่มงาน + ถ่ายรูปก่อน"/>}
            {job.submitted_at    && <TimelineRow ts={job.submitted_at}    label="ส่งตรวจ + ถ่ายรูปหลัง"/>}
            {job.inspected_at    && <TimelineRow ts={job.inspected_at}
              label={job.status === 'approved' ? '✅ ตรวจผ่าน' : '❌ ไม่ผ่าน'}
              note={job.inspection_note ?? undefined}/>}
          </div>
        </div>
      </div>

      {/* ─── Action buttons ─── */}
      <div className="px-4 py-3 border-t shrink-0">
        {/* Technician: start */}
        {isAssigned && (job.status === 'pending' || job.status === 'rejected') && (
          <button onClick={() => setAction('start')}
            className="w-full btn-primary text-base min-h-[56px]">
            <Play size={20}/> {job.status === 'rejected' ? 'แก้ไขและเริ่มใหม่' : 'เริ่มงาน (ถ่ายรูปก่อน)'}
          </button>
        )}

        {/* Technician: submit */}
        {isAssigned && job.status === 'inprogress' && (
          <button onClick={() => setAction('submit')}
            className="w-full btn-success text-base min-h-[56px]">
            <Upload size={20}/> ส่งตรวจ (ถ่ายรูปหลัง)
          </button>
        )}

        {/* Admin: inspect */}
        {isAdmin && job.status === 'awaiting_inspection' && (
          <button onClick={() => setAction('inspect')}
            className="w-full btn-primary text-base min-h-[56px]">
            <FileText size={20}/> ตรวจงาน
          </button>
        )}

        {/* Read-only states */}
        {((isAssigned && job.status === 'awaiting_inspection') ||
          job.status === 'approved' ||
          (job.status === 'rejected' && !isAssigned)) && (
          <div className="text-center text-sm text-gray-500 py-3">
            {job.status === 'awaiting_inspection' && '⏳ รอแอดมินตรวจงาน'}
            {job.status === 'approved' && '✅ งานเสร็จเรียบร้อย'}
            {job.status === 'rejected' && '❌ งานถูกตีกลับ'}
          </div>
        )}
      </div>

      {/* ─── Action modals ─── */}
      {action === 'start' && (
        <UploadPhotosFlow
          title="ถ่ายรูปก่อนเริ่มงาน"
          subtitle="ถ่ายรูปสถานที่/อุปกรณ์ก่อนทำงานอย่างน้อย 1 รูป"
          jobId={jobId}
          endpoint={`/api/jobs/${jobId}/start`}
          onSuccess={() => { setAction(null); reload() }}
          onCancel={() => setAction(null)}
        />
      )}

      {action === 'submit' && (
        <SubmitFlow
          jobId={jobId}
          onSuccess={() => { setAction(null); reload() }}
          onCancel={() => setAction(null)}
        />
      )}

      {action === 'inspect' && (
        <InspectFlow
          jobId={jobId}
          onSuccess={() => { setAction(null); reload() }}
          onCancel={() => setAction(null)}
        />
      )}

      {action === 'assign' && (
        <AssignDialog
          job={job}
          onSuccess={() => { setAction(null); reload() }}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────
function Info({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <div className="text-[10px] font-bold text-gray-500 mb-0.5 flex items-center gap-1">
          {icon} {label}
        </div>
      )}
      <div className="text-sm text-gray-900 whitespace-pre-wrap">{children}</div>
    </div>
  )
}

function PhotoGrid({ title, photos, timestamp }: { title: string; photos: string[]; timestamp: string | null }) {
  return (
    <div className="p-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-700">{title} ({photos.length})</div>
        {timestamp && (
          <div className="text-[10px] text-gray-400">
            {format(new Date(timestamp), 'd MMM HH:mm', { locale: th })}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noreferrer"
            className="aspect-square rounded-lg overflow-hidden bg-gray-100">
            <img src={url} alt="" className="w-full h-full object-cover hover:opacity-80"/>
          </a>
        ))}
      </div>
    </div>
  )
}

function TimelineRow({ ts, label, note }: { ts: string; label: string; note?: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"/>
      <div className="flex-1">
        <div className="font-semibold">{label}</div>
        {note && <div className="text-gray-500 italic">{note}</div>}
      </div>
      <div className="text-[10px] text-gray-400 shrink-0">
        {format(new Date(ts), 'd MMM HH:mm', { locale: th })}
      </div>
    </div>
  )
}

// ─── Upload before photos ─────────────────────────────────────
function UploadPhotosFlow({
  title, subtitle, jobId, endpoint, onSuccess, onCancel,
}: { title: string; subtitle: string; jobId: string; endpoint: string; onSuccess: () => void; onCancel: () => void }) {
  const [photos, setPhotos] = useState<{ blob: Blob; url: string }[]>([])
  const [uploading, setUploading] = useState(false)

  async function submit() {
    if (photos.length === 0) return toast.error('กรุณาถ่ายรูปอย่างน้อย 1 รูป')
    setUploading(true)
    try {
      const form = new FormData()
      photos.forEach((p, i) => form.append('photos', p.blob, `${i}.jpg`))
      const res  = await fetch(endpoint, { method: 'POST', body: form })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('เริ่มงานเรียบร้อย ✅')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCancel}>
      <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div>
            <div className="font-black">{title}</div>
            <div className="text-xs text-gray-500">{subtitle}</div>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400"><X size={20}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <PhotoUploader photos={photos} onChange={setPhotos} required maxPhotos={10}/>
        </div>
        <div className="p-4 border-t flex gap-2 shrink-0">
          <button onClick={onCancel} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={submit} disabled={uploading || photos.length === 0}
            className="flex-[2] btn-primary">
            {uploading ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
            {uploading ? 'กำลังอัปโหลด...' : `ยืนยัน (${photos.length} รูป)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Submit job (after photos + summary) ─────────────────────
function SubmitFlow({ jobId, onSuccess, onCancel }: { jobId: string; onSuccess: () => void; onCancel: () => void }) {
  const [photos,    setPhotos]    = useState<{ blob: Blob; url: string }[]>([])
  const [summary,   setSummary]   = useState('')
  const [materials, setMaterials] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [laborHrs,  setLaborHrs]  = useState('')
  const [uploading, setUploading] = useState(false)

  async function submit() {
    if (photos.length === 0) return toast.error('กรุณาถ่ายรูปหลังทำงานอย่างน้อย 1 รูป')
    setUploading(true)
    try {
      const form = new FormData()
      photos.forEach(p => form.append('photos', p.blob))
      if (summary)   form.append('work_summary', summary)
      if (materials) form.append('materials_used', materials)
      if (actualCost) form.append('actual_cost', actualCost)
      if (laborHrs)   form.append('labor_hours', laborHrs)

      const res  = await fetch(`/api/jobs/${jobId}/submit`, { method: 'POST', body: form })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success('ส่งตรวจเรียบร้อย ✅')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCancel}>
      <div className="w-full bg-white rounded-t-3xl max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div>
            <div className="font-black">ส่งงานตรวจ</div>
            <div className="text-xs text-gray-500">ถ่ายรูปหลังทำงาน + กรอกข้อมูลงาน</div>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <PhotoUploader label="รูปหลังทำงาน" photos={photos} onChange={setPhotos}
            required maxPhotos={10}/>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">สรุปงานที่ทำ</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
              className="input resize-none" placeholder="เช่น เปลี่ยนหลอดไฟ 5 ดวง..."/>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">วัสดุที่ใช้</label>
            <textarea value={materials} onChange={e => setMaterials(e.target.value)} rows={2}
              className="input resize-none" placeholder="เช่น หลอด LED 5 ดวง, สวิตช์ 2 ตัว..."/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">ราคาที่ใช้จริง (฿)</label>
              <input type="number" min="0" value={actualCost} onChange={e => setActualCost(e.target.value)}
                className="input"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">เวลาที่ใช้ (ชม.)</label>
              <input type="number" min="0" step="0.5" value={laborHrs} onChange={e => setLaborHrs(e.target.value)}
                className="input"/>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2 shrink-0">
          <button onClick={onCancel} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={submit} disabled={uploading || photos.length === 0}
            className="flex-[2] btn-success">
            {uploading ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}
            {uploading ? 'กำลังส่ง...' : 'ส่งตรวจ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Admin inspect flow ──────────────────────────────────────
function InspectFlow({ jobId, onSuccess, onCancel }: { jobId: string; onSuccess: () => void; onCancel: () => void }) {
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null)
  const [note,   setNote]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!result) return
    if (result === 'rejected' && !note.trim()) {
      return toast.error('กรุณาระบุเหตุผลที่ไม่ผ่าน')
    }
    setSubmitting(true)
    try {
      const res  = await fetch(`/api/jobs/${jobId}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, note: note.trim() || undefined }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(result === 'approved' ? 'อนุมัติงานเรียบร้อย ✅' : 'ตีกลับงานแล้ว — แจ้งช่างเรียบร้อย')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onCancel}>
      <div className="w-full bg-white rounded-t-3xl max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <div className="font-black">ตรวจงาน</div>
          <button onClick={onCancel} className="p-1 text-gray-400"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Result picker */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setResult('approved')}
              className={`p-6 rounded-2xl border-2 transition-all ${
                result === 'approved' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
              <CheckCircle2 size={36} className={result === 'approved' ? 'text-green-600 mx-auto' : 'text-gray-300 mx-auto'}/>
              <div className={`mt-2 font-bold ${result === 'approved' ? 'text-green-700' : 'text-gray-600'}`}>
                ผ่าน
              </div>
            </button>
            <button onClick={() => setResult('rejected')}
              className={`p-6 rounded-2xl border-2 transition-all ${
                result === 'rejected' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white'
              }`}>
              <XCircle size={36} className={result === 'rejected' ? 'text-red-600 mx-auto' : 'text-gray-300 mx-auto'}/>
              <div className={`mt-2 font-bold ${result === 'rejected' ? 'text-red-700' : 'text-gray-600'}`}>
                ไม่ผ่าน
              </div>
            </button>
          </div>

          {result === 'rejected' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                เหตุผลที่ไม่ผ่าน <span className="text-red-500">*</span>
              </label>
              <p className="text-[11px] text-gray-500 mb-2">
                ช่างจะเห็นข้อความนี้และต้องแก้ไขก่อนส่งใหม่
              </p>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
                className="input resize-none"
                placeholder="เช่น: งานไม่เรียบร้อย ต้องแก้ไขรอยรั่ว / ใช้วัสดุไม่ตรงสเปก..."/>
            </div>
          )}

          {result === 'approved' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                className="input resize-none"
                placeholder="คำชม / ข้อเสนอแนะเพิ่มเติม..."/>
            </div>
          )}

          {result === 'rejected' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800
              flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5"/>
              <div>
                การตีกลับจะนับเป็น <b>การปฏิเสธครั้งที่ 1</b> และส่งแจ้งเตือนไปยังช่าง
                ช่างต้องอัปโหลดรูปก่อนทำใหม่และส่งตรวจอีกครั้ง
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex gap-2 shrink-0">
          <button onClick={onCancel} className="flex-1 btn-ghost">ยกเลิก</button>
          <button onClick={submit} disabled={!result || submitting}
            className={`flex-[2] ${result === 'approved' ? 'btn-success' : result === 'rejected' ? 'btn-danger' : 'btn-primary'}`}>
            {submitting ? <Loader2 className="animate-spin" size={16}/> : (
              result === 'approved' ? <Check size={16}/> :
              result === 'rejected' ? <X size={16}/> : null
            )}
            {submitting ? 'กำลังบันทึก...' :
             result === 'approved' ? 'ยืนยันผ่าน' :
             result === 'rejected' ? 'ยืนยันไม่ผ่าน' : 'เลือกผลการตรวจก่อน'}
          </button>
        </div>
      </div>
    </div>
  )
}

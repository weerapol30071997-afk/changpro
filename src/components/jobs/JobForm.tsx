'use client'
/**
 * JobForm — admin creates/edits a job
 */
import { useState } from 'react'
import useSWR from 'swr'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { X, Loader2 } from 'lucide-react'
import type { EmployeeExtended } from '@/types/employee'
import type { JobExtended } from '@/lib/repositories/jobs'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)

const Schema = z.object({
  title:            z.string().min(1, 'กรุณากรอกชื่องาน'),
  description:      z.string().optional(),
  assigned_to:      z.string().optional(),
  priority:         z.enum(['low','normal','high','urgent']),
  location:         z.string().optional(),
  scheduled_at:     z.string().optional(),
  customer_name:    z.string().optional(),
  customer_phone:   z.string().optional(),
  customer_address: z.string().optional(),
  estimated_cost:   z.coerce.number().min(0).optional(),
  notes:            z.string().optional(),
})

type Values = z.infer<typeof Schema>

const PRIORITY = [
  { value: 'low',    label: '🟢 ไม่ด่วน',  cls: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: '🔵 ปกติ',     cls: 'bg-blue-100 text-blue-700' },
  { value: 'high',   label: '🟡 ด่วน',     cls: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: '🔴 ด่วนมาก',  cls: 'bg-red-100 text-red-700' },
] as const

type Props = {
  existing?: JobExtended
  onSuccess: () => void
  onClose:   () => void
}

export function JobForm({ existing, onSuccess, onClose }: Props) {
  const { data: employees = [] } = useSWR<EmployeeExtended[]>('/api/employees', fetcher)
  const [saving, setSaving] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: {
      title:            existing?.title            ?? '',
      description:      existing?.description      ?? '',
      assigned_to:      existing?.assigned_to      ?? '',
      priority:         (existing?.priority as any) ?? 'normal',
      location:         existing?.location         ?? '',
      scheduled_at:     existing?.scheduled_at     ?? '',
      customer_name:    existing?.customer_name    ?? '',
      customer_phone:   existing?.customer_phone   ?? '',
      customer_address: existing?.customer_address ?? '',
      estimated_cost:   existing?.estimated_cost   ?? undefined,
      notes:            existing?.notes            ?? '',
    },
  })

  async function onSubmit(v: Values) {
    setSaving(true)
    try {
      const payload: any = { ...v }
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k]
      })
      const url    = existing ? `/api/jobs/${existing.id}` : '/api/jobs'
      const method = existing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(existing ? 'อัปเดตงานแล้ว' : 'สร้างงานแล้ว — แจ้งช่างเรียบร้อย')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full max-h-[92dvh] bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-black">{existing ? '✏️ แก้ไขงาน' : '➕ สร้างงานใหม่'}</h2>
        <button type="button" onClick={onClose} className="text-gray-400 p-1"><X size={20}/></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <FF label="ชื่องาน *" error={form.formState.errors.title?.message}>
          <input {...form.register('title')} className="input" placeholder="เช่น ซ่อมไฟฟ้าอาคาร A"/>
        </FF>

        <FF label="รายละเอียดงาน">
          <textarea {...form.register('description')} rows={2} className="input resize-none"
            placeholder="รายละเอียดปัญหา/สิ่งที่ต้องทำ..."/>
        </FF>

        <FF label="มอบหมายให้ช่าง">
          <select {...form.register('assigned_to')} className="input">
            <option value="">-- ยังไม่มอบหมาย --</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} · {e.role}</option>
            ))}
          </select>
        </FF>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">ความสำคัญ</label>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITY.map(p => (
              <label key={p.value} className={`flex items-center justify-center px-2 py-2 rounded-xl border-2 cursor-pointer text-[11px] font-bold ${
                form.watch('priority') === p.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                <input type="radio" {...form.register('priority')} value={p.value} className="sr-only"/>
                {p.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FF label="สถานที่"><input {...form.register('location')} className="input"/></FF>
          <FF label="เวลานัด"><input type="datetime-local" {...form.register('scheduled_at')} className="input"/></FF>
        </div>

        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-3">
          <div className="font-bold text-sm text-amber-700">👤 ลูกค้า / สถานที่</div>
          <div className="grid grid-cols-2 gap-3">
            <FF label="ชื่อลูกค้า"><input {...form.register('customer_name')} className="input"/></FF>
            <FF label="เบอร์โทร"><input {...form.register('customer_phone')} className="input"/></FF>
          </div>
          <FF label="ที่อยู่"><textarea {...form.register('customer_address')} rows={2} className="input resize-none"/></FF>
        </div>

        <FF label="ราคาประมาณการ (฿)"><input type="number" min="0" {...form.register('estimated_cost')} className="input"/></FF>

        <FF label="หมายเหตุภายใน"><textarea {...form.register('notes')} rows={2} className="input resize-none"/></FF>
      </div>

      <div className="flex gap-2 px-4 py-3 border-t shrink-0">
        <button type="button" onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
        <button type="submit" disabled={saving} className="flex-[2] btn-primary">
          {saving ? <Loader2 className="animate-spin" size={16}/> : '💾'}
          {saving ? 'กำลังบันทึก...' : existing ? 'บันทึกการแก้ไข' : 'สร้างงาน'}
        </button>
      </div>
    </form>
  )
}

function FF({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      {children}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}

'use client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, Users, Phone, Mail, MapPin, Star, X, Loader2,
  Crown, Tag as TagIcon, Briefcase, TrendingUp,
} from 'lucide-react'
import type { Customer, CustomerLTV } from '@/types/enterprise'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH').format(Math.round(n || 0))

const TIER_STYLES = {
  platinum: { label: '💎 Platinum', cls: 'bg-purple-100 text-purple-700' },
  gold:     { label: '🥇 Gold',     cls: 'bg-amber-100 text-amber-700' },
  silver:   { label: '🥈 Silver',   cls: 'bg-gray-200 text-gray-700' },
  bronze:   { label: '🥉 Bronze',   cls: 'bg-orange-100 text-orange-700' },
}

export default function CustomersPage() {
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState<Customer | 'new' | null>(null)

  const { data: customers = [] } = useSWR<CustomerLTV[]>('/api/customers', fetcher)
  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.customer_code.includes(search.toUpperCase())
  )

  const totalRev = customers.reduce((s, c) => s + Number(c.total_revenue || 0), 0)
  const tiers    = customers.reduce((acc, c: any) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black">ลูกค้า ({customers.length})</h1>
          <p className="text-sm text-gray-500">CRM · จัดการลูกค้า · ประวัติงาน</p>
        </div>
        <button onClick={() => setShowForm('new')} className="btn-primary"><Plus size={18}/> เพิ่ม</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard icon="💰" label="รายได้รวม" value={`฿${thbN(totalRev)}`} small/>
        <StatCard icon="💎" label="Platinum"  value={tiers.platinum ?? 0}/>
        <StatCard icon="🥇" label="Gold"      value={tiers.gold ?? 0}/>
        <StatCard icon="📞" label="ทั้งหมด"  value={customers.length}/>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ เบอร์ รหัสลูกค้า..."
          className="input pl-9"/>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Users size={36} className="mx-auto mb-3 opacity-40"/>
          <p>{customers.length === 0 ? 'ยังไม่มีลูกค้า' : 'ไม่พบที่ตรงเงื่อนไข'}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c: any) => {
            const tier = TIER_STYLES[c.tier as keyof typeof TIER_STYLES]
            return (
              <button key={c.id} onClick={() => setShowForm(c)}
                className="card p-4 w-full text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                    text-white font-black flex items-center justify-center shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{c.name}</span>
                      {tier && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.cls}`}>{tier.label}</span>}
                      {c.type === 'business' && <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-bold">บริษัท</span>}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{c.customer_code}</div>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-600">
                      {c.phone && <span className="flex items-center gap-1"><Phone size={11}/>{c.phone}</span>}
                      {c.province && <span className="flex items-center gap-1"><MapPin size={11}/>{c.province}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-bold text-blue-700">
                        <Briefcase size={11} className="inline -mt-0.5"/> {c.total_jobs ?? 0} งาน
                      </span>
                      <span className="font-bold text-green-700">
                        ฿{thbN(c.total_revenue ?? 0)}
                      </span>
                      {c.avg_rating && (
                        <span className="font-bold text-amber-600">
                          <Star size={11} className="inline -mt-0.5 fill-current"/> {Number(c.avg_rating).toFixed(1)}
                        </span>
                      )}
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.tags.map((t: string) => (
                          <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {showForm && (
        <CustomerForm
          initial={showForm === 'new' ? undefined : showForm}
          onClose={() => setShowForm(null)}
          onSuccess={() => { setShowForm(null); mutate('/api/customers') }}
        />
      )}
    </div>
  )
}

function StatCard({ icon, label, value, small }: any) {
  return (
    <div className="card p-3">
      <div className="text-base">{icon}</div>
      <div className={`font-black ${small ? 'text-sm' : 'text-xl'} text-gray-900 mt-0.5`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

// ─── Form ──────────────────────────────────────────────────────
const Schema = z.object({
  name:    z.string().min(1, 'กรุณากรอกชื่อ'),
  type:    z.enum(['individual','business']),
  contact_name: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.string().email().optional().or(z.literal('')),
  line_id: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  postcode: z.string().optional(),
  tax_id:  z.string().optional(),
  notes:   z.string().optional(),
  tags:    z.string().optional(),  // comma-separated
})

function CustomerForm({ initial, onClose, onSuccess }: { initial?: Customer; onClose: () => void; onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: {
      name:    initial?.name ?? '',
      type:    initial?.type ?? 'individual',
      contact_name: initial?.contact_name ?? '',
      phone:   initial?.phone ?? '',
      email:   initial?.email ?? '',
      line_id: initial?.line_id ?? '',
      address: initial?.address ?? '',
      district: initial?.district ?? '',
      province: initial?.province ?? '',
      postcode: initial?.postcode ?? '',
      tax_id:  initial?.tax_id ?? '',
      notes:   initial?.notes ?? '',
      tags:    (initial?.tags ?? []).join(', '),
    },
  })

  async function onSubmit(v: any) {
    setSaving(true)
    try {
      const payload: any = { ...v }
      payload.tags = v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      Object.keys(payload).forEach(k => { if (payload[k] === '' || payload[k] === undefined) delete payload[k] })

      const url    = initial ? `/api/customers/${initial.id}` : '/api/customers'
      const method = initial ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json   = await res.json()
      if (!json.ok) throw new Error(json.message)
      toast.success(initial ? 'อัปเดตแล้ว' : 'เพิ่มลูกค้าแล้ว')
      onSuccess()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={onClose}>
      <form onSubmit={form.handleSubmit(onSubmit)}
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl max-h-[90dvh] flex flex-col slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b flex justify-between items-center shrink-0">
          <div>
            <div className="font-black">{initial ? '✏️ แก้ไขลูกค้า' : '➕ เพิ่มลูกค้า'}</div>
            {initial && <div className="text-[10px] text-gray-500">{initial.customer_code}</div>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 p-1"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Field label="ประเภท">
            <div className="grid grid-cols-2 gap-2">
              {(['individual','business'] as const).map(t => (
                <label key={t} className={`flex items-center justify-center px-3 py-2 rounded-xl border-2 cursor-pointer text-xs font-bold ${
                  form.watch('type') === t ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}>
                  <input type="radio" {...form.register('type')} value={t} className="sr-only"/>
                  {t === 'individual' ? '👤 บุคคล' : '🏢 บริษัท'}
                </label>
              ))}
            </div>
          </Field>

          <Field label="ชื่อ *" error={form.formState.errors.name?.message}>
            <input {...form.register('name')} className="input"/>
          </Field>

          {form.watch('type') === 'business' && (
            <Field label="ผู้ติดต่อ">
              <input {...form.register('contact_name')} className="input" placeholder="ชื่อพนักงานผู้ติดต่อ"/>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="เบอร์โทร"><input {...form.register('phone')} className="input"/></Field>
            <Field label="LINE ID"><input {...form.register('line_id')} className="input"/></Field>
          </div>
          <Field label="อีเมล" error={form.formState.errors.email?.message}>
            <input type="email" {...form.register('email')} className="input"/>
          </Field>

          <Field label="ที่อยู่">
            <textarea {...form.register('address')} rows={2} className="input resize-none"/>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="ตำบล"><input {...form.register('district')} className="input"/></Field>
            <Field label="จังหวัด"><input {...form.register('province')} className="input"/></Field>
            <Field label="รหัสไปรษณีย์"><input {...form.register('postcode')} className="input"/></Field>
          </div>

          {form.watch('type') === 'business' && (
            <Field label="เลขผู้เสียภาษี"><input {...form.register('tax_id')} className="input"/></Field>
          )}

          <Field label="แท็ก" hint="คั่นด้วย comma เช่น VIP, ขาประจำ">
            <input {...form.register('tags')} className="input"/>
          </Field>

          <Field label="หมายเหตุภายใน">
            <textarea {...form.register('notes')} rows={2} className="input resize-none"/>
          </Field>
        </div>

        <div className="p-4 border-t flex gap-2 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 btn-ghost">ยกเลิก</button>
          <button type="submit" disabled={saving} className="flex-[2] btn-primary">
            {saving ? <Loader2 className="animate-spin" size={16}/> : '💾'} บันทึก
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, hint, error, children }: any) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      {hint && <div className="text-[10px] text-gray-500 mb-1">{hint}</div>}
      {children}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}

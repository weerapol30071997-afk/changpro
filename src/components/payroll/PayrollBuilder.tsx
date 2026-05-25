'use client'
/**
 * PayrollBuilder v4 — supports daily/monthly/hourly payment types.
 *
 * Flow:
 *   1. Admin picks date range
 *   2. App calls /api/payroll/compute-hours with prorate_method
 *   3. DB function `compute_payroll_suggestion()` returns suggested amounts
 *   4. Admin can adjust prorate_method or override base/OT manually
 *   5. All math (allowances, SSO, tax) updates live
 *   6. Submit to /api/payroll
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { format, differenceInDays } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  Calendar, Clock, DollarSign, Plus, Minus, FileText, Check,
  Loader2, AlertCircle, ChevronRight, ChevronLeft, RefreshCw, Info,
} from 'lucide-react'
import type { EmployeeExtended, PayrollSuggestion, ProrateMethod } from '@/types/employee'

// ─── Constants ────────────────────────────────────────────────
const SSO_CEILING       = 15_000
const SSO_FLOOR         = 1_650
const ALLOW_TYPES       = ['เบี้ยเลี้ยง','ค่าเดินทาง','ค่าที่พัก','ค่าอาหาร','เงินรางวัล','โบนัส','เงินพิเศษ','ค่าล่วงเวลาพิเศษ','ค่าครองชีพ','คอมมิชชั่น'] as const
const DEDUCT_TYPES      = ['ขาดงาน','มาสาย','ลาไม่รับเงิน','เงินกู้','ทรัพย์สินเสียหาย','ค่าปรับ','หักล่วงหน้า','อื่นๆ'] as const
const PAY_METHODS       = [{ value:'bank',key:'โอนธนาคาร' },{ value:'cash',key:'จ่ายสด' },{ value:'promptpay',key:'PromptPay' }] as const

const PAYMENT_TYPE_LABEL = {
  daily:   'รายวัน',
  monthly: 'รายเดือน',
  hourly:  'รายชั่วโมง',
}

const PRORATE_LABELS: Record<ProrateMethod, string> = {
  full:          'จ่ายเต็มเดือน',
  work_days:     'จ่ายตามวันทำงานจริง',
  calendar_days: 'จ่ายตามวันปฏิทิน',
  manual:        'กรอกเอง',
}

const today        = () => format(new Date(), 'yyyy-MM-dd')
const firstOfMonth = () => format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
const thb          = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n) + ' ฿'
const thbN         = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2 }).format(n)

// ─── Schema ───────────────────────────────────────────────────
const Schema = z.object({
  period_from:    z.string().min(1, 'กรุณาเลือกวันเริ่มงวด'),
  period_to:      z.string().min(1, 'กรุณาเลือกวันสิ้นงวด'),
  pay_date:       z.string().min(1, 'กรุณาเลือกวันจ่าย'),
  pay_method:     z.enum(['bank','cash','promptpay']),
  prorate_method: z.enum(['full','work_days','calendar_days','manual']),
  work_days:      z.coerce.number().int().min(0),
  total_hours:    z.coerce.number().min(0),
  ot_hours:       z.coerce.number().min(0),
  base_amount:    z.coerce.number().min(0),
  ot_amount:      z.coerce.number().min(0),
  sso_rate:       z.coerce.number().min(0).max(10),
  tax_rate:       z.coerce.number().min(0).max(30),
  ot_multiplier:  z.coerce.number().min(1).max(5),
  allowances: z.array(z.object({
    id: z.string(), type: z.string().min(1), amount: z.coerce.number().min(0), note: z.string(),
  })),
  deductions: z.array(z.object({
    id: z.string(), type: z.string().min(1), amount: z.coerce.number().min(0), note: z.string(),
  })),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof Schema>

// ─── Props ────────────────────────────────────────────────────
type Props = {
  employee:  EmployeeExtended
  existing?: any
  onSuccess: () => void
  onClose:   () => void
}

// ─── Component ────────────────────────────────────────────────
export function PayrollBuilder({ employee, existing, onSuccess, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [suggestion, setSuggestion] = useState<PayrollSuggestion | null>(null)
  const [computing,  setComputing]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [computeErr, setComputeErr] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      period_from:    existing?.period_from    ?? firstOfMonth(),
      period_to:      existing?.period_to      ?? today(),
      pay_date:       existing?.pay_date       ?? today(),
      pay_method:     existing?.pay_method     ?? 'bank',
      prorate_method: existing?.prorate_method ??
                      (employee.payment_type === 'monthly' ? 'work_days' : 'work_days'),
      work_days:      existing?.work_days     ?? 0,
      total_hours:    existing?.total_hours   ?? 0,
      ot_hours:       existing?.ot_hours      ?? 0,
      base_amount:    existing?.base_amount   ?? 0,
      ot_amount:      existing?.ot_amount     ?? 0,
      sso_rate:       existing?.sso_rate      ?? employee.sso_rate,
      tax_rate:       existing?.tax_rate      ?? employee.tax_rate,
      ot_multiplier:  existing?.ot_multiplier ?? employee.ot_multiplier,
      allowances:     existing?.allowances    ?? [],
      deductions:     existing?.deductions    ?? [],
      note:           existing?.note          ?? '',
    },
  })

  const { fields: allowFields,  append: appendAllow,  remove: removeAllow  } =
    useFieldArray({ control: form.control, name: 'allowances' })
  const { fields: deductFields, append: appendDeduct, remove: removeDeduct } =
    useFieldArray({ control: form.control, name: 'deductions' })

  const v = form.watch()

  // ─── Live totals ──────────────────────────────────────────
  const totals = useMemo(() => {
    const allowTotal  = v.allowances.reduce((s, a) => s + Number(a.amount||0), 0)
    const deductTotal = v.deductions.reduce((s, d) => s + Number(d.amount||0), 0)
    const gross       = Number(v.base_amount) + Number(v.ot_amount) + allowTotal
    const ssoBase     = Math.max(SSO_FLOOR, Math.min(gross, SSO_CEILING))
    const sso         = Math.round(ssoBase * (Number(v.sso_rate)/100))
    const tax         = Math.round(gross  * (Number(v.tax_rate) /100))
    const net         = gross - sso - tax - deductTotal
    return { allowTotal, deductTotal, gross, ssoBase, sso, tax, net }
  }, [v.base_amount, v.ot_amount, v.allowances, v.deductions, v.sso_rate, v.tax_rate])

  // ─── Fetch suggestion from server ─────────────────────────
  const fetchSuggestion = useCallback(async () => {
    const from = form.getValues('period_from')
    const to   = form.getValues('period_to')
    const pm   = form.getValues('prorate_method')
    if (!from || !to || from > to) { setComputeErr('ช่วงวันที่ไม่ถูกต้อง'); return }

    setComputeErr(null)
    setComputing(true)
    try {
      const res  = await fetch('/api/payroll/compute-hours', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          employee_id: employee.id,
          period_from: from,
          period_to:   to,
          prorate_method: pm,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)

      const data: PayrollSuggestion = json.data
      setSuggestion(data)
      form.setValue('work_days',   data.work_days,   { shouldDirty: true })
      form.setValue('total_hours', data.total_hours, { shouldDirty: true })
      form.setValue('ot_hours',    data.ot_hours,    { shouldDirty: true })
      form.setValue('base_amount', data.base_amount, { shouldDirty: true })
      form.setValue('ot_amount',   data.ot_amount,   { shouldDirty: true })

      toast.success(
        `พบ ${data.work_days} วัน (${data.total_hours.toFixed(1)} ชม.) — แนะนำจ่าย ${thbN(data.base_amount)} ฿`
      )
    } catch (e: any) {
      setComputeErr(e.message)
      toast.error(e.message)
    } finally {
      setComputing(false)
    }
  }, [employee.id, form])

  // Auto-compute on mount (new only) and on prorate method change
  useEffect(() => { if (!existing) fetchSuggestion() }, [])  // eslint-disable-line
  useEffect(() => {
    if (suggestion && v.prorate_method !== suggestion.payment_type) {
      // recompute when method changes (only meaningful for monthly)
      if (employee.payment_type === 'monthly') fetchSuggestion()
    }
    // eslint-disable-next-line
  }, [v.prorate_method])

  // ─── Submit ───────────────────────────────────────────────
  async function onSubmit(data: FormValues) {
    setSaving(true)
    try {
      const payload = {
        ...data,
        employee_id:        employee.id,
        payment_type:       employee.payment_type,
        daily_rate_used:    suggestion?.daily_rate  ?? 0,
        hourly_rate_used:   suggestion?.hourly_rate ?? 0,
        period_calendar_days: suggestion?.calendar_days ?? 0,
        period_work_days:     suggestion?.work_days     ?? 0,
        gross_amount:       totals.gross,
        sso_amount:         totals.sso,
        tax_amount:         totals.tax,
        net_amount:         totals.net,
        day_breakdown:      suggestion?.day_breakdown ?? [],
      }
      const url    = existing ? `/api/payroll/${existing.id}` : '/api/payroll'
      const method = existing ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message)

      toast.success(existing ? 'อัปเดตสลิปแล้ว' : 'สร้างสลิปแล้ว')
      onSuccess()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const steps = [
    { label: 'งวด',         Icon: Calendar     },
    { label: 'เวลาทำงาน',  Icon: Clock        },
    { label: 'เงิน & OT',  Icon: DollarSign   },
    { label: 'เพิ่ม/หัก',   Icon: Plus         },
    { label: 'ภาษี',         Icon: FileText     },
    { label: 'ยืนยัน',       Icon: Check        },
  ]

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full max-h-[92dvh] bg-white">
      {/* ─── Header with employee + payment type ─── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
          flex items-center justify-center text-white font-black">
          {employee.full_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{employee.full_name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">{employee.role}</span>
            <PaymentTypeBadge type={employee.payment_type}/>
          </div>
        </div>
        <button type="button" onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-2xl leading-none px-2">✕</button>
      </div>

      {/* ─── Step pills (scrollable) ─── */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b shrink-0">
        {steps.map((s, i) => (
          <button key={i} type="button" onClick={() => setStep(i)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              i === step ? 'bg-blue-600 text-white' :
              i  < step ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
            <s.Icon size={12}/> {i < step ? '✓' : i+1} {s.label}
          </button>
        ))}
      </div>

      {/* ─── Live net banner ─── */}
      <div className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 flex justify-between items-center shrink-0">
        <div>
          <div className="text-white/70 text-[10px]">ยอดสุทธิ (real-time)</div>
          <div className={`font-black text-lg leading-tight ${totals.net >= 0 ? 'text-white' : 'text-red-200'}`}>
            {thb(totals.net)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-white/70 text-[10px]">Gross</div>
          <div className="text-white text-sm font-bold">{thbN(totals.gross)}</div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* STEP 0: Period */}
        {step === 0 && (
          <div className="space-y-3">
            <StepHead title="กำหนดงวดเงินเดือน" sub="เลือกช่วงวันที่ที่ต้องการคำนวณ"/>
            <div className="grid grid-cols-2 gap-3">
              <Field label="วันเริ่มงวด" error={form.formState.errors.period_from?.message}>
                <input type="date" {...form.register('period_from')} className="input"/>
              </Field>
              <Field label="วันสิ้นงวด" error={form.formState.errors.period_to?.message}>
                <input type="date" {...form.register('period_to')} className="input"/>
              </Field>
              <Field label="วันจ่ายเงิน">
                <input type="date" {...form.register('pay_date')} className="input"/>
              </Field>
              <Field label="วิธีจ่าย">
                <select {...form.register('pay_method')} className="input">
                  {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.key}</option>)}
                </select>
              </Field>
            </div>

            {v.pay_method === 'bank' && employee.bank_account && (
              <InfoBox>🏦 {employee.bank_name} · {employee.bank_account}</InfoBox>
            )}

            {v.period_from && v.period_to && v.period_from <= v.period_to && (
              <div className="bg-blue-50 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-blue-700 font-bold">ระยะเวลา</span>
                  <span className="text-blue-700 font-black">
                    {differenceInDays(new Date(v.period_to), new Date(v.period_from)) + 1} วัน
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {format(new Date(v.period_from), 'd MMM', { locale: th })} —
                  {format(new Date(v.period_to),   ' d MMM yyyy', { locale: th })}
                </div>
              </div>
            )}

            {/* Pro-ration method (monthly employees only) */}
            {employee.payment_type === 'monthly' && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">วิธีคำนวณเงินเดือน</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['work_days','full','calendar_days','manual'] as ProrateMethod[]).map(m => (
                    <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer ${
                      v.prorate_method === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}>
                      <input type="radio" {...form.register('prorate_method')} value={m}
                        className="text-blue-600"/>
                      <span className="text-xs font-semibold">{PRORATE_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
                <ProrateExplain method={v.prorate_method} employee={employee}/>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Hours */}
        {step === 1 && (
          <div className="space-y-3">
            <StepHead title="ข้อมูลเวลาทำงาน" sub="ดึงข้อมูลจาก DB อัตโนมัติ หรือกรอกเอง"/>
            <button type="button" onClick={fetchSuggestion} disabled={computing}
              className="w-full btn-primary flex items-center justify-center gap-2 min-h-[52px]">
              {computing ? <Loader2 className="animate-spin" size={18}/> : <RefreshCw size={18}/>}
              {computing ? 'กำลังคำนวณ...' : 'คำนวณจากระบบลงเวลา'}
            </button>

            {computeErr && (
              <div className="bg-red-50 text-red-700 rounded-xl p-3 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5"/>
                <span>{computeErr}</span>
              </div>
            )}

            {suggestion && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'วันทำงาน',   v: `${suggestion.work_days} วัน`, c: 'text-blue-600 bg-blue-50' },
                  { label: 'ชั่วโมงรวม', v: `${suggestion.total_hours.toFixed(1)} ชม.`, c: 'text-green-600 bg-green-50' },
                  { label: 'OT รวม',     v: `${suggestion.ot_hours.toFixed(1)} ชม.`,    c: 'text-amber-600 bg-amber-50' },
                ].map((s, i) => (
                  <div key={i} className={`rounded-xl p-3 text-center ${s.c}`}>
                    <div className="font-black text-base">{s.v}</div>
                    <div className="text-[10px] mt-0.5 opacity-70">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Day-by-day breakdown */}
            {suggestion?.day_breakdown && suggestion.day_breakdown.length > 0 && (
              <details className="rounded-xl border bg-gray-50">
                <summary className="px-4 py-3 cursor-pointer font-bold text-sm flex items-center justify-between">
                  <span>📋 รายละเอียด {suggestion.day_breakdown.length} วัน</span>
                  <ChevronRight size={16} className="rotate-90"/>
                </summary>
                <div className="overflow-x-auto px-2 pb-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white">
                        {['วันที่','เข้า','ออก','ปกติ','OT'].map(h =>
                          <th key={h} className="px-2 py-2 text-left font-bold text-gray-500">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {suggestion.day_breakdown.map((d: any, i: number) => (
                        <tr key={i} className={i % 2 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-2 py-1.5 font-semibold whitespace-nowrap">
                            {format(new Date(d.date), 'EEE d MMM', { locale: th })}
                          </td>
                          <td className="px-2 py-1.5 text-green-600">
                            {d.clock_in ? format(new Date(d.clock_in), 'HH:mm') : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-red-500">
                            {d.clock_out ? format(new Date(d.clock_out), 'HH:mm') : '—'}
                          </td>
                          <td className="px-2 py-1.5 font-bold">{d.std_hrs.toFixed(1)}</td>
                          <td className={`px-2 py-1.5 font-bold ${d.ot_hrs > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {d.ot_hrs.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}

            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <div className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <Info size={12}/> ปรับแก้ตัวเลขเอง
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="วันทำงาน">
                  <input type="number" min="0" {...form.register('work_days')} className="input text-center"/>
                </Field>
                <Field label="ชั่วโมง">
                  <input type="number" min="0" step="0.5" {...form.register('total_hours')} className="input text-center"/>
                </Field>
                <Field label="OT (ชม.)">
                  <input type="number" min="0" step="0.5" {...form.register('ot_hours')} className="input text-center"/>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Money */}
        {step === 2 && (
          <div className="space-y-3">
            <StepHead title="เงินเดือน & ค่าล่วงเวลา"
              sub={`คำนวณตามอัตรา${PAYMENT_TYPE_LABEL[employee.payment_type]} · แก้ไขได้`}/>

            <div className="grid grid-cols-3 gap-2 text-center">
              <RateCard
                icon="📅" label="อัตรา/วัน"
                value={`${thbN(suggestion?.daily_rate ?? 0)} ฿`}/>
              <RateCard
                icon="⏰" label="อัตรา/ชม."
                value={`${(suggestion?.hourly_rate ?? 0).toFixed(2)} ฿`}/>
              <RateCard
                icon="⚡" label="OT ×"
                value={`${v.ot_multiplier}`}/>
            </div>

            {employee.payment_type === 'monthly' && suggestion && (
              <div className="bg-blue-50 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">เงินเดือนเต็มเดือน:</span>
                  <b className="text-gray-900">{thbN(suggestion.full_period_amount)} ฿</b></div>
                <div className="flex justify-between"><span className="text-gray-600">วิธีคิด:</span>
                  <b className="text-blue-700">{PRORATE_LABELS[v.prorate_method]}</b></div>
                <div className="flex justify-between"><span className="text-gray-600">แนะนำให้จ่าย:</span>
                  <b className="text-green-700">{thbN(suggestion.base_amount)} ฿</b></div>
              </div>
            )}

            <Field label="เงินเดือนฐาน (฿)"
              hint={
                employee.payment_type === 'daily'
                  ? `${v.work_days} วัน × ${thbN(suggestion?.daily_rate ?? 0)} ฿/วัน`
                : employee.payment_type === 'hourly'
                  ? `${v.total_hours} ชม. × ${(suggestion?.hourly_rate ?? 0).toFixed(2)} ฿/ชม.`
                  : `รายเดือน · ${PRORATE_LABELS[v.prorate_method]}`
              }>
              <input type="number" min="0" step="0.01" {...form.register('base_amount')}
                className="input font-bold text-blue-700"/>
            </Field>

            <Field label="ค่าล่วงเวลา (OT)"
              hint={`${v.ot_hours} ชม. × ${(suggestion?.hourly_rate ?? 0).toFixed(2)} × ${v.ot_multiplier}`}>
              <input type="number" min="0" step="0.01" {...form.register('ot_amount')}
                className="input font-bold text-amber-600"/>
            </Field>

            <Field label="อัตรา OT (×เท่า)" hint="ปกติคือ 1.5 หรือ 2 เท่าตามกฎหมาย">
              <input type="number" min="1" max="5" step="0.5" {...form.register('ot_multiplier')} className="input"/>
            </Field>
          </div>
        )}

        {/* STEP 3: Allowances & Deductions */}
        {step === 3 && (
          <div className="space-y-4">
            <StepHead title="รายรับเพิ่ม & รายการหัก" sub="ไม่จำกัดจำนวนรายการ"/>

            {/* Allowances */}
            <Section
              titleColor="text-green-700" headerBg="bg-green-50"
              title={<><Plus size={14}/> รายรับพิเศษ</>}
              total={totals.allowTotal > 0 ? thbN(totals.allowTotal) + ' ฿' : null}
              onAdd={() => appendAllow({ id: crypto.randomUUID(), type: ALLOW_TYPES[0], amount: 0, note: '' })}>
              {allowFields.length === 0 && <Empty>ยังไม่มีรายการ</Empty>}
              {allowFields.map((f, i) => (
                <ItemCard key={f.id} onRemove={() => removeAllow(i)} accent="green" index={i+1}>
                  <Field label="ประเภท">
                    <select {...form.register(`allowances.${i}.type`)} className="input">
                      {ALLOW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="จำนวน (฿)">
                    <input type="number" min="0" step="0.01" {...form.register(`allowances.${i}.amount`)} className="input"/>
                  </Field>
                  <div className="col-span-2">
                    <Field label="หมายเหตุ">
                      <input type="text" {...form.register(`allowances.${i}.note`)} className="input" placeholder="..."/>
                    </Field>
                  </div>
                </ItemCard>
              ))}
            </Section>

            {/* Deductions */}
            <Section
              titleColor="text-red-700" headerBg="bg-red-50"
              title={<><Minus size={14}/> รายการหัก</>}
              total={totals.deductTotal > 0 ? thbN(totals.deductTotal) + ' ฿' : null}
              onAdd={() => appendDeduct({ id: crypto.randomUUID(), type: DEDUCT_TYPES[0], amount: 0, note: '' })}>
              {deductFields.length === 0 && <Empty>ยังไม่มีรายการ</Empty>}
              {deductFields.map((f, i) => (
                <ItemCard key={f.id} onRemove={() => removeDeduct(i)} accent="red" index={i+1}>
                  <Field label="ประเภท">
                    <select {...form.register(`deductions.${i}.type`)} className="input">
                      {DEDUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="จำนวน (฿)">
                    <input type="number" min="0" step="0.01" {...form.register(`deductions.${i}.amount`)} className="input"/>
                  </Field>
                  <div className="col-span-2">
                    <Field label="หมายเหตุ">
                      <input type="text" {...form.register(`deductions.${i}.note`)} className="input" placeholder="..."/>
                    </Field>
                  </div>
                </ItemCard>
              ))}
            </Section>
          </div>
        )}

        {/* STEP 4: Tax */}
        {step === 4 && (
          <div className="space-y-3">
            <StepHead title="ภาษี & ประกันสังคม" sub={`เพดาน SSO: ${thbN(SSO_CEILING)} ฿`}/>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="text-sm font-bold mb-2">🛡 ประกันสังคม</div>
                <Field label="อัตรา %" hint={`ฐานคำนวณ: ${thbN(totals.ssoBase)} ฿`}>
                  <input type="number" min="0" max="10" step="0.5" {...form.register('sso_rate')} className="input"/>
                </Field>
                <div className="text-2xl font-black text-red-500 mt-2">{thb(totals.sso)}</div>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="text-sm font-bold mb-2">📋 ภาษีหัก ณ ที่จ่าย</div>
                <Field label="อัตรา %" hint={`คิดจาก gross: ${thbN(totals.gross)} ฿`}>
                  <input type="number" min="0" max="30" step="0.5" {...form.register('tax_rate')} className="input"/>
                </Field>
                <div className="text-2xl font-black text-red-500 mt-2">{thb(totals.tax)}</div>
              </div>
            </div>

            {/* Calculation table */}
            <div className="rounded-2xl overflow-hidden border">
              {[
                ['เงินเดือนฐาน',              v.base_amount,             'text-gray-800'],
                [`OT (${v.ot_hours} ชม.)`,    v.ot_amount,               'text-amber-600'],
                ['รายรับพิเศษ',                totals.allowTotal,         'text-green-600'],
                ['Gross รวม',                  totals.gross,              'text-blue-700 font-black', true],
                [`ประกัน ${v.sso_rate}%`,     -totals.sso,                'text-red-500'],
                [`ภาษี ${v.tax_rate}%`,       -totals.tax,                'text-red-500'],
                ['รายการหัก',                  -totals.deductTotal,       'text-red-500'],
                ['สุทธิ',                       totals.net,               totals.net >= 0 ? 'text-green-700 font-black' : 'text-red-700 font-black', true],
              ].map(([l, val, cls, bold]: any, i) => (
                <div key={i} className={`flex justify-between px-4 py-2.5 border-b ${
                  bold ? 'bg-blue-50' : ''
                } ${i === 7 ? '!bg-green-50' : ''}`}>
                  <span className="text-sm text-gray-600">{l}</span>
                  <span className={`text-sm ${cls}`}>{thb(Math.abs(val))}</span>
                </div>
              ))}
            </div>

            <Field label="หมายเหตุเพิ่มเติม">
              <textarea {...form.register('note')} rows={2} className="input resize-none"
                placeholder="หมายเหตุภายใน เช่น เหตุผลที่หัก..."/>
            </Field>
          </div>
        )}

        {/* STEP 5: Confirm */}
        {step === 5 && (
          <div className="space-y-3">
            <StepHead title="ตรวจสอบและบันทึก"/>

            {/* Final card */}
            <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 p-5 text-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center font-black text-xl">
                  {employee.full_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base truncate">{employee.full_name}</div>
                  <div className="text-xs text-white/70">{employee.role}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">
                    {format(new Date(v.period_from), 'd MMM', { locale: th })} —
                    {format(new Date(v.period_to),   ' d MMM yyyy', { locale: th })}
                  </div>
                </div>
                <PaymentTypeBadge type={employee.payment_type} dark/>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { l: 'วันทำงาน', v: `${v.work_days} วัน` },
                  { l: 'Gross',    v: thbN(totals.gross) },
                  { l: 'หัก',      v: thbN(totals.sso + totals.tax + totals.deductTotal) },
                ].map((s, i) => (
                  <div key={i} className="bg-white/15 rounded-xl p-2.5 text-center">
                    <div className="font-black text-sm">{s.v}</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white/15 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-sm text-white/80">ยอดสุทธิที่จ่าย</div>
                  <div className="text-[11px] text-white/60 mt-0.5">
                    {format(new Date(v.pay_date), 'd MMM yyyy', { locale: th })} ·
                    {PAY_METHODS.find(m => m.value === v.pay_method)?.key}
                  </div>
                </div>
                <div className={`text-3xl font-black ${totals.net >= 0 ? 'text-white' : 'text-red-200'}`}>
                  {thbN(totals.net)} ฿
                </div>
              </div>
            </div>

            {v.pay_method === 'bank' && (
              <InfoBox>🏦 โอนเข้า {employee.bank_name} · {employee.bank_account}</InfoBox>
            )}
          </div>
        )}
      </div>

      {/* ─── Nav footer ─── */}
      <div className="flex gap-2 px-4 py-3 border-t bg-white shrink-0">
        {step > 0 && (
          <button type="button" onClick={() => setStep(s => s-1)}
            className="flex-1 btn-ghost"><ChevronLeft size={16}/> ก่อนหน้า</button>
        )}
        {step < steps.length - 1 ? (
          <button type="button" onClick={() => setStep(s => s+1)}
            className="flex-[2] btn-primary">ถัดไป <ChevronRight size={16}/></button>
        ) : (
          <button type="submit" disabled={saving}
            className="flex-[2] btn-success">
            {saving ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>}
            {saving ? 'กำลังบันทึก...' : 'บันทึกสลิป'}
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Sub-components ───────────────────────────────────────────
function StepHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h3 className="font-black text-gray-900 text-lg">{title}</h3>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <div className="text-[10px] text-gray-500 mb-1">{hint}</div>}
      {children}
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-blue-50 text-blue-700 rounded-xl px-3 py-2.5 text-xs flex items-start gap-2">
    <Info size={14} className="shrink-0 mt-0.5"/>
    <span>{children}</span>
  </div>
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-400 text-center py-3">{children}</p>
}

function RateCard({ icon, label, value }: any) {
  return (
    <div className="bg-blue-50 rounded-2xl p-3">
      <div className="text-lg mb-1">{icon}</div>
      <div className="font-black text-blue-700 text-sm">{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

function Section({ title, headerBg, titleColor, total, onAdd, children }: any) {
  return (
    <div className={`rounded-2xl border-2 ${headerBg.replace('bg-','border-').replace('-50','-100')}`}>
      <div className={`flex justify-between items-center px-4 py-3 ${headerBg}`}>
        <span className={`font-bold text-sm flex items-center gap-1 ${titleColor}`}>{title}</span>
        <div className="flex items-center gap-2">
          {total && <span className={`text-xs font-bold ${titleColor}`}>{total}</span>}
          <button type="button" onClick={onAdd}
            className={`text-xs ${titleColor.replace('text-','bg-').replace('-700','-600')} text-white rounded-lg px-3 py-1.5 font-bold`}>
            + เพิ่ม
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2 bg-white rounded-b-2xl">{children}</div>
    </div>
  )
}

function ItemCard({ children, onRemove, accent, index }: any) {
  return (
    <div className={`bg-${accent}-50/50 rounded-xl p-3 border border-${accent}-100`}>
      <div className="flex justify-between mb-2">
        <span className="text-[10px] font-bold text-gray-500">รายการ {index}</span>
        <button type="button" onClick={onRemove}
          className={`text-[10px] text-${accent}-600 font-bold px-2 py-0.5 rounded`}>ลบ</button>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}

function PaymentTypeBadge({ type, dark }: { type: string; dark?: boolean }) {
  const colors: Record<string, string> = {
    daily:   dark ? 'bg-amber-200 text-amber-900'   : 'bg-amber-100 text-amber-700',
    monthly: dark ? 'bg-blue-200 text-blue-900'     : 'bg-blue-100 text-blue-700',
    hourly:  dark ? 'bg-purple-200 text-purple-900' : 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors[type]}`}>
      {PAYMENT_TYPE_LABEL[type as keyof typeof PAYMENT_TYPE_LABEL]}
    </span>
  )
}

function ProrateExplain({ method, employee }: { method: ProrateMethod; employee: EmployeeExtended }) {
  const std = employee.standard_days_per_month
  const exp = {
    full:          `จ่ายเต็มเดือน ${thbN(employee.base_salary)} ฿ ไม่ว่าจะทำงานกี่วัน`,
    work_days:     `จ่ายตามวันทำงานจริง: ${thbN(employee.base_salary)} ÷ ${std} วัน × วันทำงาน`,
    calendar_days: `จ่ายตามวันปฏิทิน: ${thbN(employee.base_salary)} × วันที่อยู่ในงวด ÷ 30`,
    manual:        `กรอกตัวเลขเอง`,
  }
  return (
    <div className="text-[11px] text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2">
      💡 {exp[method]}
    </div>
  )
}

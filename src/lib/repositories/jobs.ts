/**
 * Jobs Repository
 * - CRUD
 * - Workflow: start, submit, inspect (approve/reject)
 * - Photo upload to job-photos bucket
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database, type Job } from '@/types/database'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

export type JobStatus =
  | 'pending' | 'inprogress' | 'awaiting_inspection'
  | 'approved' | 'rejected'  | 'done' | 'cancelled'

export type JobExtended = Job & {
  before_photos:    string[]
  after_photos:     string[]
  started_at:       string | null
  submitted_at:     string | null
  inspected_by:     string | null
  inspected_at:     string | null
  inspection_note:  string | null
  rejection_count:  number
  customer_name:    string | null
  customer_phone:   string | null
  customer_address: string | null
  work_summary:     string | null
  materials_used:   string | null
  estimated_cost:   number | null
  actual_cost:      number | null
  labor_hours:      number | null
  employee?:        { id: string; full_name: string; role: string; avatar_url: string | null } | null
  inspector?:       { id: string; full_name: string } | null
}

export type CreateJobInput = {
  title:           string
  description?:    string
  assigned_to?:    string
  priority:        'low' | 'normal' | 'high' | 'urgent'
  location?:       string
  scheduled_at?:   string
  customer_name?:  string
  customer_phone?: string
  customer_address?: string
  estimated_cost?: number
  notes?:          string
}

// ─── READ ─────────────────────────────────────────────────────
export async function listJobs(
  db: DB,
  org_id: string,
  filter: { status?: JobStatus; assigned_to?: string; search?: string } = {}
): Promise<JobExtended[]> {
  let query = (db as any)
    .from('jobs')
    .select(`
      *,
      employee:employees!jobs_assigned_to_fkey (id, full_name, role, avatar_url),
      inspector:profiles!jobs_inspected_by_fkey (id, full_name)
    `)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })

  if (filter.status)      query = query.eq('status', filter.status)
  if (filter.assigned_to) query = query.eq('assigned_to', filter.assigned_to)
  if (filter.search)      query = query.ilike('title', `%${filter.search}%`)

  const { data, error } = await query
  if (error) throw new AppError('FETCH_JOBS_FAILED', error.message)
  return data
}

export async function getJob(db: DB, id: string): Promise<JobExtended> {
  const { data, error } = await (db as any)
    .from('jobs')
    .select(`
      *,
      employee:employees!jobs_assigned_to_fkey (id, full_name, role, avatar_url, phone),
      inspector:profiles!jobs_inspected_by_fkey (id, full_name)
    `)
    .eq('id', id).single()
  if (error) throw new AppError('JOB_NOT_FOUND', error.message, 404)
  return data
}

// ─── CREATE / UPDATE / DELETE ─────────────────────────────────
export async function createJob(
  db: DB,
  org_id: string,
  created_by: string,
  input: CreateJobInput
): Promise<JobExtended> {
  const { data, error } = await (db as any)
    .from('jobs')
    .insert({
      ...input,
      org_id,
      created_by,
      status: 'pending',
    })
    .select().single()
  if (error) throw new AppError('CREATE_JOB_FAILED', error.message)
  return data
}

export async function updateJob(
  db: DB,
  id: string,
  input: Partial<CreateJobInput>
): Promise<JobExtended> {
  const { data, error } = await (db as any)
    .from('jobs').update(input).eq('id', id).select().single()
  if (error) throw new AppError('UPDATE_JOB_FAILED', error.message)
  return data
}

export async function deleteJob(db: DB, id: string): Promise<void> {
  const { error } = await db.from('jobs').delete().eq('id', id)
  if (error) throw new AppError('DELETE_JOB_FAILED', error.message)
}

// ─── PHOTO UPLOAD ─────────────────────────────────────────────
export async function uploadJobPhoto(
  db: DB,
  job_id: string,
  blob: Blob,
  kind: 'before' | 'after'
): Promise<string> {
  const ts   = Date.now()
  const ext  = blob.type.split('/')[1] || 'jpg'
  const path = `jobs/${job_id}/${kind}/${ts}.${ext}`

  const { error } = await db.storage
    .from('job-photos')
    .upload(path, blob, { contentType: blob.type, cacheControl: '604800' })
  if (error) throw new AppError('PHOTO_UPLOAD_FAILED', error.message)

  const { data } = db.storage.from('job-photos').getPublicUrl(path)
  return data.publicUrl
}

// ─── WORKFLOW: start (technician) ─────────────────────────────
export async function startJob(
  db: DB,
  id: string,
  before_photos: string[],
  caller_employee_id: string
): Promise<JobExtended> {
  if (before_photos.length === 0) {
    throw new AppError('BEFORE_PHOTOS_REQUIRED',
      'กรุณาถ่ายรูปก่อนเริ่มงานอย่างน้อย 1 รูป', 400)
  }

  // Validate caller is assigned to this job
  const job = await getJob(db, id)
  if (job.assigned_to !== caller_employee_id) {
    throw new AppError('NOT_ASSIGNED', 'คุณไม่ได้รับมอบหมายงานนี้', 403)
  }
  if (job.status !== 'pending' && job.status !== 'rejected') {
    throw new AppError('INVALID_STATUS', 'สถานะงานปัจจุบันไม่สามารถเริ่มได้', 400)
  }

  const { data, error } = await (db as any)
    .from('jobs')
    .update({
      status:        'inprogress',
      started_at:    new Date().toISOString(),
      before_photos: [...(job.before_photos || []), ...before_photos],
    })
    .eq('id', id).select().single()
  if (error) throw new AppError('START_JOB_FAILED', error.message)
  return data
}

// ─── WORKFLOW: submit for inspection (technician) ────────────
export type SubmitJobInput = {
  after_photos:    string[]
  work_summary?:   string
  materials_used?: string
  actual_cost?:    number
  labor_hours?:    number
}

export async function submitJob(
  db: DB,
  id: string,
  input: SubmitJobInput,
  caller_employee_id: string
): Promise<JobExtended> {
  if (input.after_photos.length === 0) {
    throw new AppError('AFTER_PHOTOS_REQUIRED',
      'กรุณาถ่ายรูปหลังทำงานอย่างน้อย 1 รูป', 400)
  }

  const job = await getJob(db, id)
  if (job.assigned_to !== caller_employee_id) {
    throw new AppError('NOT_ASSIGNED', 'คุณไม่ได้รับมอบหมายงานนี้', 403)
  }
  if (job.status !== 'inprogress') {
    throw new AppError('INVALID_STATUS', 'ต้องเริ่มงานก่อนจึงจะส่งตรวจได้', 400)
  }

  const { data, error } = await (db as any)
    .from('jobs')
    .update({
      status:         'awaiting_inspection',
      submitted_at:   new Date().toISOString(),
      after_photos:   [...(job.after_photos || []), ...input.after_photos],
      work_summary:   input.work_summary   ?? job.work_summary,
      materials_used: input.materials_used ?? job.materials_used,
      actual_cost:    input.actual_cost    ?? job.actual_cost,
      labor_hours:    input.labor_hours    ?? job.labor_hours,
    })
    .eq('id', id).select().single()
  if (error) throw new AppError('SUBMIT_JOB_FAILED', error.message)
  return data
}

// ─── WORKFLOW: inspect (admin/manager) ───────────────────────
export type InspectionResult = 'approved' | 'rejected'

export async function inspectJob(
  db: DB,
  id: string,
  result: InspectionResult,
  inspector_id: string,    // profile id
  note?: string
): Promise<JobExtended> {
  const job = await getJob(db, id)
  if (job.status !== 'awaiting_inspection') {
    throw new AppError('NOT_AWAITING_INSPECTION',
      'งานยังไม่ได้ส่งตรวจ', 400)
  }
  if (result === 'rejected' && !note?.trim()) {
    throw new AppError('REASON_REQUIRED',
      'กรุณาระบุเหตุผลที่ไม่ผ่านการตรวจ', 400)
  }

  const updates: any = {
    status:          result,
    inspected_by:    inspector_id,
    inspected_at:    new Date().toISOString(),
    inspection_note: note ?? null,
  }
  if (result === 'approved') updates.completed_at = new Date().toISOString()
  if (result === 'rejected') updates.rejection_count = (job.rejection_count ?? 0) + 1

  const { data, error } = await (db as any)
    .from('jobs').update(updates).eq('id', id).select().single()
  if (error) throw new AppError('INSPECT_JOB_FAILED', error.message)
  return data
}

// ─── Delete individual photo ─────────────────────────────────
export async function removePhoto(
  db: DB,
  job_id: string,
  url:    string,
  kind:   'before' | 'after'
): Promise<JobExtended> {
  const job  = await getJob(db, job_id)
  const list = (kind === 'before' ? job.before_photos : job.after_photos) || []
  const next = list.filter(u => u !== url)

  // Best-effort: delete from storage too
  try {
    const path = url.split('/job-photos/')[1]
    if (path) await db.storage.from('job-photos').remove([path])
  } catch {}

  const col = kind === 'before' ? 'before_photos' : 'after_photos'
  const { data, error } = await (db as any)
    .from('jobs').update({ [col]: next }).eq('id', job_id).select().single()
  if (error) throw new AppError('REMOVE_PHOTO_FAILED', error.message)
  return data
}

// ─── ASSIGN / REASSIGN job to specific employee ──────────────
export async function assignJob(
  db: DB,
  id: string,
  new_employee_id: string | null   // null = unassign
): Promise<JobExtended> {
  const job = await getJob(db, id)

  // Can't reassign if work is already in progress beyond pending stage
  // (avoid losing photos/work). Allow unassign or change while pending only.
  if (job.assigned_to && job.assigned_to !== new_employee_id) {
    if (!['pending', 'rejected'].includes(job.status)) {
      throw new AppError('CANNOT_REASSIGN',
        `ไม่สามารถเปลี่ยนช่างได้ในสถานะ "${job.status}" — ต้องยกเลิกหรือรอให้งานเสร็จก่อน`, 400)
    }
  }

  const { data, error } = await (db as any)
    .from('jobs')
    .update({ assigned_to: new_employee_id })
    .eq('id', id)
    .select(`
      *,
      employee:employees!jobs_assigned_to_fkey (id, full_name, role, avatar_url, phone),
      inspector:profiles!jobs_inspected_by_fkey (id, full_name)
    `).single()
  if (error) throw new AppError('ASSIGN_FAILED', error.message)
  return data
}

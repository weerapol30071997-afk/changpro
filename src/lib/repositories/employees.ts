/**
 * Employee Repository
 * All DB queries for employees go here — NO raw supabase calls in components
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database, type Employee } from '@/types/database'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

export type CreateEmployeeInput = {
  full_name: string
  role: string
  phone?: string
  email?: string
  address?: string
  start_date?: string
  bank_name?: string
  bank_account?: string
  bank_account_name?: string
  base_salary: number
  daily_rate?: number
  hourly_rate?: number
  ot_multiplier?: number
  sso_rate?: number
  tax_rate?: number
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  status?: Employee['status']
  avatar_url?: string
  employee_code?: string
}

// ─── READ ─────────────────────────────────────────────────────
export async function listEmployees(db: DB, orgId: string): Promise<Employee[]> {
  const { data, error } = await db
    .from('employees')
    .select('*')
    .eq('org_id', orgId)
    .neq('status', 'resigned')
    .order('full_name')

  if (error) throw new AppError('FETCH_EMPLOYEES_FAILED', error.message)
  return data
}

export async function getEmployee(db: DB, id: string): Promise<Employee> {
  const { data, error } = await db
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new AppError('EMPLOYEE_NOT_FOUND', error.message, 404)
  return data
}

// ─── WRITE ────────────────────────────────────────────────────
export async function createEmployee(
  db: DB,
  orgId: string,
  input: CreateEmployeeInput
): Promise<Employee> {
  const { data, error } = await db
    .from('employees')
    .insert({ ...input, org_id: orgId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new AppError('DUPLICATE_EMPLOYEE_CODE', 'รหัสพนักงานซ้ำ', 409)
    throw new AppError('CREATE_EMPLOYEE_FAILED', error.message)
  }
  return data
}

export async function updateEmployee(
  db: DB,
  id: string,
  input: UpdateEmployeeInput
): Promise<Employee> {
  const { data, error } = await db
    .from('employees')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new AppError('UPDATE_EMPLOYEE_FAILED', error.message)
  return data
}

export async function softDeleteEmployee(db: DB, id: string): Promise<void> {
  const { error } = await db
    .from('employees')
    .update({ status: 'resigned', end_date: new Date().toISOString().split('T')[0] })
    .eq('id', id)

  if (error) throw new AppError('DELETE_EMPLOYEE_FAILED', error.message)
}

// ─── UPLOAD AVATAR ────────────────────────────────────────────
export async function uploadAvatar(
  db: DB,
  employeeId: string,
  file: File
): Promise<string> {
  const ext  = file.name.split('.').pop()
  const path = `avatars/${employeeId}.${ext}`

  const { error: uploadError } = await db.storage
    .from('employee-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw new AppError('UPLOAD_FAILED', uploadError.message)

  const { data } = db.storage.from('employee-assets').getPublicUrl(path)
  return data.publicUrl
}

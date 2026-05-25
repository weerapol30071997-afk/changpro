/**
 * Enterprise repositories — customers, services, holidays, leaves,
 * materials, ratings, documents, audit log, analytics
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/database'
import type {
  Customer, Service, Holiday, LeaveRequest, Material, MaterialMovement,
  JobMaterial, Rating, AuditLog, Document, EmployeePerformance,
  MonthlyRevenue, CustomerLTV, OrgSettings,
} from '@/types/enterprise'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

// ════════════════════════════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════════════════════════════
export const Customers = {
  async list(db: DB, org_id: string, search?: string): Promise<Customer[]> {
    let q = (db as any).from('customers').select('*').eq('org_id', org_id).eq('is_active', true).order('name')
    if (search) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,customer_code.ilike.%${search}%`)
    const { data, error } = await q
    if (error) throw new AppError('FETCH_CUSTOMERS_FAILED', error.message)
    return data
  },
  async get(db: DB, id: string): Promise<Customer> {
    const { data, error } = await (db as any).from('customers').select('*').eq('id', id).single()
    if (error) throw new AppError('CUSTOMER_NOT_FOUND', error.message, 404)
    return data
  },
  async create(db: DB, org_id: string, created_by: string, input: Partial<Customer>): Promise<Customer> {
    const { data, error } = await (db as any).from('customers')
      .insert({ ...input, org_id, created_by }).select().single()
    if (error) throw new AppError('CREATE_CUSTOMER_FAILED', error.message)
    return data
  },
  async update(db: DB, id: string, input: Partial<Customer>): Promise<Customer> {
    const { data, error } = await (db as any).from('customers').update(input).eq('id', id).select().single()
    if (error) throw new AppError('UPDATE_CUSTOMER_FAILED', error.message)
    return data
  },
  async softDelete(db: DB, id: string): Promise<void> {
    const { error } = await (db as any).from('customers').update({ is_active: false }).eq('id', id)
    if (error) throw new AppError('DELETE_CUSTOMER_FAILED', error.message)
  },
  async listLTV(db: DB, org_id: string): Promise<CustomerLTV[]> {
    const { data, error } = await (db as any).from('customer_ltv')
      .select('*').eq('org_id', org_id).order('total_revenue', { ascending: false })
    if (error) throw new AppError('FETCH_LTV_FAILED', error.message)
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// SERVICES (catalog)
// ════════════════════════════════════════════════════════════════
export const Services = {
  async list(db: DB, org_id: string): Promise<Service[]> {
    const { data, error } = await (db as any).from('services').select('*')
      .eq('org_id', org_id).eq('is_active', true).order('use_count', { ascending: false })
    if (error) throw new AppError('FETCH_SERVICES_FAILED', error.message)
    return data
  },
  async get(db: DB, id: string): Promise<Service> {
    const { data, error } = await (db as any).from('services').select('*').eq('id', id).single()
    if (error) throw new AppError('SERVICE_NOT_FOUND', error.message, 404)
    return data
  },
  async create(db: DB, org_id: string, input: Partial<Service>): Promise<Service> {
    const code = input.code || `SVC${String(Date.now()).slice(-5)}`
    const { data, error } = await (db as any).from('services')
      .insert({ ...input, code, org_id }).select().single()
    if (error) throw new AppError('CREATE_SERVICE_FAILED', error.message)
    return data
  },
  async update(db: DB, id: string, input: Partial<Service>): Promise<Service> {
    const { data, error } = await (db as any).from('services').update(input).eq('id', id).select().single()
    if (error) throw new AppError('UPDATE_SERVICE_FAILED', error.message)
    return data
  },
  async incrementUse(db: DB, id: string): Promise<void> {
    await (db as any).rpc('increment', { table_name: 'services', row_id: id, col: 'use_count' })
      .catch(() => { /* fallback to direct update */
        return (db as any).from('services').update({
          use_count: (db as any).from('services').select('use_count').eq('id', id).single()
            .then((r: any) => (r.data?.use_count ?? 0) + 1)
        }).eq('id', id)
      })
  },
}

// ════════════════════════════════════════════════════════════════
// HOLIDAYS
// ════════════════════════════════════════════════════════════════
export const Holidays = {
  async list(db: DB, org_id: string, year?: number): Promise<Holiday[]> {
    let q = (db as any).from('holidays').select('*').eq('org_id', org_id).order('date')
    if (year) {
      q = q.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    }
    const { data, error } = await q
    if (error) throw new AppError('FETCH_HOLIDAYS_FAILED', error.message)
    return data
  },
  async create(db: DB, org_id: string, input: Partial<Holiday>): Promise<Holiday> {
    const { data, error } = await (db as any).from('holidays')
      .insert({ ...input, org_id }).select().single()
    if (error) throw new AppError('CREATE_HOLIDAY_FAILED', error.message)
    return data
  },
  async remove(db: DB, id: string): Promise<void> {
    const { error } = await (db as any).from('holidays').delete().eq('id', id)
    if (error) throw new AppError('DELETE_HOLIDAY_FAILED', error.message)
  },
  async isHoliday(db: DB, org_id: string, date: string): Promise<Holiday | null> {
    const { data } = await (db as any).from('holidays')
      .select('*').eq('org_id', org_id).eq('date', date).maybeSingle()
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// LEAVE REQUESTS
// ════════════════════════════════════════════════════════════════
export const Leaves = {
  async list(db: DB, org_id: string, filter: { employee_id?: string; status?: string } = {}): Promise<LeaveRequest[]> {
    let q = (db as any).from('leave_requests')
      .select('*, employee:employees(full_name, role, avatar_url)')
      .eq('org_id', org_id).order('start_date', { ascending: false })
    if (filter.employee_id) q = q.eq('employee_id', filter.employee_id)
    if (filter.status)      q = q.eq('status', filter.status)
    const { data, error } = await q
    if (error) throw new AppError('FETCH_LEAVES_FAILED', error.message)
    return data
  },
  async create(db: DB, org_id: string, employee_id: string, input: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const total_days = input.total_days ??
      ((new Date(input.end_date!).getTime() - new Date(input.start_date!).getTime()) / 86400000 + 1)
    const { data, error } = await (db as any).from('leave_requests')
      .insert({ ...input, org_id, employee_id, total_days }).select().single()
    if (error) throw new AppError('CREATE_LEAVE_FAILED', error.message)
    return data
  },
  async review(db: DB, id: string, status: 'approved'|'rejected', reviewed_by: string, note?: string): Promise<LeaveRequest> {
    const { data, error } = await (db as any).from('leave_requests').update({
      status, reviewed_by, reviewed_at: new Date().toISOString(), review_note: note,
    }).eq('id', id).select().single()
    if (error) throw new AppError('REVIEW_LEAVE_FAILED', error.message)

    // If approved, deduct from balance
    if (status === 'approved' && data) {
      const balanceCol = data.kind === 'vacation' ? 'leave_balance_vacation'
                       : data.kind === 'sick'     ? 'leave_balance_sick'
                       : data.kind === 'personal' ? 'leave_balance_personal'
                       : null
      if (balanceCol) {
        await (db as any).from('employees').update({
          [balanceCol]: (db as any).raw(`${balanceCol} - ${data.total_days}`),
        }).eq('id', data.employee_id).catch(() => {})
      }
    }
    return data
  },
  async cancel(db: DB, id: string): Promise<void> {
    const { error } = await (db as any).from('leave_requests')
      .update({ status: 'cancelled' }).eq('id', id)
    if (error) throw new AppError('CANCEL_LEAVE_FAILED', error.message)
  },
}

// ════════════════════════════════════════════════════════════════
// MATERIALS / INVENTORY
// ════════════════════════════════════════════════════════════════
export const Materials = {
  async list(db: DB, org_id: string, options: { low_stock_only?: boolean; search?: string } = {}): Promise<Material[]> {
    let q = (db as any).from('materials').select('*')
      .eq('org_id', org_id).eq('is_active', true).order('name')
    if (options.low_stock_only) q = q.filter('stock_qty', 'lte', 'min_stock')
    if (options.search) q = q.or(`name.ilike.%${options.search}%,code.ilike.%${options.search}%`)
    const { data, error } = await q
    if (error) throw new AppError('FETCH_MATERIALS_FAILED', error.message)
    return data
  },
  async create(db: DB, org_id: string, input: Partial<Material>): Promise<Material> {
    const code = input.code || `MAT${String(Date.now()).slice(-6)}`
    const { data, error } = await (db as any).from('materials')
      .insert({ ...input, code, org_id }).select().single()
    if (error) throw new AppError('CREATE_MATERIAL_FAILED', error.message)
    return data
  },
  async update(db: DB, id: string, input: Partial<Material>): Promise<Material> {
    const { data, error } = await (db as any).from('materials').update(input).eq('id', id).select().single()
    if (error) throw new AppError('UPDATE_MATERIAL_FAILED', error.message)
    return data
  },
  async addMovement(db: DB, org_id: string, performed_by: string, input: Partial<MaterialMovement>): Promise<MaterialMovement> {
    // 'out' / 'job_consume' should be negative quantity
    const qty = input.kind === 'out' || input.kind === 'job_consume'
      ? -Math.abs(input.quantity!)
      : Math.abs(input.quantity!)
    const { data, error } = await (db as any).from('material_movements')
      .insert({ ...input, quantity: qty, org_id, performed_by }).select().single()
    if (error) throw new AppError('CREATE_MOVEMENT_FAILED', error.message)
    return data
  },
  async movementHistory(db: DB, material_id: string): Promise<MaterialMovement[]> {
    const { data, error } = await (db as any).from('material_movements')
      .select('*').eq('material_id', material_id).order('created_at', { ascending: false }).limit(50)
    if (error) throw new AppError('FETCH_MOVEMENTS_FAILED', error.message)
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// JOB MATERIALS (link materials to jobs)
// ════════════════════════════════════════════════════════════════
export const JobMaterials = {
  async listByJob(db: DB, job_id: string): Promise<JobMaterial[]> {
    const { data, error } = await (db as any).from('job_materials')
      .select('*, material:materials(name, code, unit)').eq('job_id', job_id)
    if (error) throw new AppError('FETCH_JOB_MATERIALS_FAILED', error.message)
    return data
  },
  async add(db: DB, org_id: string, job_id: string, material_id: string, quantity: number, unit_cost: number, note?: string): Promise<JobMaterial> {
    const { data, error } = await (db as any).from('job_materials')
      .insert({ org_id, job_id, material_id, quantity, unit_cost, note }).select().single()
    if (error) throw new AppError('ADD_JOB_MATERIAL_FAILED', error.message)
    // Auto-deduct from stock
    await Materials.addMovement(db, org_id, '', {
      material_id, kind: 'job_consume', quantity, unit_cost,
      reference_id: job_id, reference_kind: 'job',
    }).catch(() => {})
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// RATINGS
// ════════════════════════════════════════════════════════════════
export const Ratings = {
  async listForJob(db: DB, job_id: string): Promise<Rating | null> {
    const { data } = await (db as any).from('ratings')
      .select('*, employee:employees(full_name, role), customer:customers(name)')
      .eq('job_id', job_id).maybeSingle()
    return data
  },
  async listForEmployee(db: DB, employee_id: string, limit = 20): Promise<Rating[]> {
    const { data, error } = await (db as any).from('ratings')
      .select('*, customer:customers(name)')
      .eq('employee_id', employee_id).order('created_at', { ascending: false }).limit(limit)
    if (error) throw new AppError('FETCH_RATINGS_FAILED', error.message)
    return data
  },
  async create(db: DB, org_id: string, input: Partial<Rating>): Promise<Rating> {
    const { data, error } = await (db as any).from('ratings').insert({ ...input, org_id }).select().single()
    if (error) throw new AppError('CREATE_RATING_FAILED', error.message)
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════════════════════════
export const Audit = {
  async log(db: DB, entry: Partial<AuditLog>): Promise<void> {
    await (db as any).from('audit_log').insert(entry).catch(() => {})
  },
  async list(db: DB, org_id: string, filter: { entity_kind?: string; entity_id?: string; limit?: number } = {}): Promise<AuditLog[]> {
    let q = (db as any).from('audit_log').select('*')
      .eq('org_id', org_id).order('created_at', { ascending: false }).limit(filter.limit ?? 100)
    if (filter.entity_kind) q = q.eq('entity_kind', filter.entity_kind)
    if (filter.entity_id)   q = q.eq('entity_id', filter.entity_id)
    const { data, error } = await q
    if (error) throw new AppError('FETCH_AUDIT_FAILED', error.message)
    return data
  },
}

// ════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════
export const Analytics = {
  async employeePerformance(db: DB, org_id: string): Promise<EmployeePerformance[]> {
    const { data, error } = await (db as any).from('employee_performance')
      .select('*').eq('org_id', org_id).order('total_revenue_earned', { ascending: false })
    if (error) throw new AppError('FETCH_PERFORMANCE_FAILED', error.message)
    return data
  },
  async monthlyRevenue(db: DB, org_id: string, year: number): Promise<MonthlyRevenue[]> {
    const { data, error } = await (db as any).from('monthly_revenue').select('*')
      .eq('org_id', org_id).gte('month', `${year}-01`).lte('month', `${year}-12`).order('month')
    if (error) throw new AppError('FETCH_REVENUE_FAILED', error.message)
    return data ?? []
  },
  async overview(db: DB, org_id: string) {
    // Combine multiple counts into one call
    const [emp, jobsActive, jobsToday, jobsAwaiting, lowStock, pendingLeaves] = await Promise.all([
      (db as any).from('employees').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).eq('status', 'active'),
      (db as any).from('jobs').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).in('status', ['pending','inprogress']),
      (db as any).from('time_logs').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).is('clock_out', null),
      (db as any).from('jobs').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).eq('status', 'awaiting_inspection'),
      (db as any).from('materials').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).filter('stock_qty', 'lte', 'min_stock'),
      (db as any).from('leave_requests').select('id', { count: 'exact', head: true })
        .eq('org_id', org_id).eq('status', 'pending'),
    ])
    return {
      employees:        emp.count ?? 0,
      active_jobs:      jobsActive.count ?? 0,
      currently_working: jobsToday.count ?? 0,
      awaiting_inspection: jobsAwaiting.count ?? 0,
      low_stock_items:  lowStock.count ?? 0,
      pending_leaves:   pendingLeaves.count ?? 0,
    }
  },
}

// ════════════════════════════════════════════════════════════════
// ORG SETTINGS
// ════════════════════════════════════════════════════════════════
export const Org = {
  async get(db: DB, org_id: string): Promise<OrgSettings> {
    const { data, error } = await (db as any).from('organizations').select('*').eq('id', org_id).single()
    if (error) throw new AppError('FETCH_ORG_FAILED', error.message)
    return data
  },
  async update(db: DB, org_id: string, input: Partial<OrgSettings>): Promise<OrgSettings> {
    const { data, error } = await (db as any).from('organizations').update(input).eq('id', org_id).select().single()
    if (error) throw new AppError('UPDATE_ORG_FAILED', error.message)
    return data
  },
}

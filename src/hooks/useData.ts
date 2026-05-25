/**
 * Data hooks — typed SWR wrappers over API routes
 * Components import these, never call fetch/supabase directly
 */
import useSWR, { type KeyedMutator } from 'swr'
import useSWRMutation from 'swr/mutation'

// ─── Typed fetcher ────────────────────────────────────────────
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!json.ok) throw new Error(json.message ?? 'Request failed')
  return json.data
}

async function mutator<TBody, TResult>(
  url: string,
  { arg }: { arg: { method?: string; body?: TBody } }
): Promise<TResult> {
  const res = await fetch(url, {
    method:  arg.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    arg.body ? JSON.stringify(arg.body) : undefined,
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.message ?? 'Mutation failed')
  return json.data
}

// ─── Employees ────────────────────────────────────────────────
export function useEmployees() {
  return useSWR('/api/employees', fetcher<any[]>)
}

export function useEmployee(id: string | null) {
  return useSWR(id ? `/api/employees/${id}` : null, fetcher<any>)
}

export function useCreateEmployee() {
  return useSWRMutation('/api/employees', mutator)
}

export function useUpdateEmployee(id: string) {
  return useSWRMutation(`/api/employees/${id}`, (url, { arg }: { arg: any }) =>
    mutator(url, { arg: { method: 'PUT', body: arg } })
  )
}

export function useDeleteEmployee(id: string) {
  return useSWRMutation(`/api/employees/${id}`, (url, _) =>
    mutator(url, { arg: { method: 'DELETE' } })
  )
}

// ─── Time Logs ────────────────────────────────────────────────
export function useTimeLogs(params?: { employee_id?: string; from?: string; to?: string }) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString()
    : ''
  return useSWR(`/api/timeclock${qs}`, fetcher<{ logs: any[]; today_log: any | null }>)
}

export function useClockIn() {
  return useSWRMutation('/api/timeclock/in', (url, { arg }: { arg: { coords?: { lat: number; lng: number } } }) =>
    mutator(url, { arg: { body: arg } })
  )
}

export function useClockOut() {
  return useSWRMutation('/api/timeclock/out', (url, { arg }: { arg: { coords?: { lat: number; lng: number } } }) =>
    mutator(url, { arg: { body: arg } })
  )
}

// ─── Payroll ──────────────────────────────────────────────────
export function usePayroll(month?: string) {
  const qs = month ? `?month=${month}` : ''
  return useSWR(`/api/payroll${qs}`, fetcher<{ periods: any[]; summary: any | null }>)
}

export function usePayrollPeriod(id: string | null) {
  return useSWR(id ? `/api/payroll/${id}` : null, fetcher<any>)
}

export function useComputeHours() {
  return useSWRMutation('/api/payroll/compute-hours', (url, { arg }: { arg: { employee_id: string; period_from: string; period_to: string } }) =>
    mutator(url, { arg: { body: arg } })
  )
}

export function useCreatePayroll() {
  return useSWRMutation('/api/payroll', mutator)
}

export function useUpdatePayroll(id: string) {
  return useSWRMutation(`/api/payroll/${id}`, (url, { arg }: { arg: any }) =>
    mutator(url, { arg: { method: 'PUT', body: arg } })
  )
}

export function useApprovePayroll(id: string) {
  return useSWRMutation(`/api/payroll/${id}/approve`, (url, _) =>
    mutator(url, { arg: {} })
  )
}

export function useMarkPayrollPaid(id: string) {
  return useSWRMutation(`/api/payroll/${id}/pay`, (url, _) =>
    mutator(url, { arg: {} })
  )
}

export function useDeletePayroll(id: string) {
  return useSWRMutation(`/api/payroll/${id}`, (url, _) =>
    mutator(url, { arg: { method: 'DELETE' } })
  )
}

// ─── Jobs ─────────────────────────────────────────────────────
export function useJobs(params?: { status?: string; assigned_to?: string }) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([,v]) => v)).toString()
    : ''
  return useSWR(`/api/jobs${qs}`, fetcher<any[]>)
}

export function useCreateJob() {
  return useSWRMutation('/api/jobs', mutator)
}

export function useUpdateJobStatus(id: string) {
  return useSWRMutation(`/api/jobs/${id}`, (url, { arg }: { arg: { status: string } }) =>
    mutator(url, { arg: { method: 'PUT', body: arg } })
  )
}

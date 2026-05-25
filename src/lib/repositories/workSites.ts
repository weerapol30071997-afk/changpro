import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/database'
import { type WorkSite } from '@/types/tracking'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

export type CreateSiteInput = {
  name:     string
  address?: string
  lat:      number
  lng:      number
  radius_m: number
}

export async function listSites(db: DB, org_id: string): Promise<WorkSite[]> {
  const { data, error } = await (db as any)
    .from('work_sites')
    .select('*')
    .eq('org_id', org_id)
    .eq('is_active', true)
    .order('name')
  if (error) throw new AppError('FETCH_SITES_FAILED', error.message)
  return data
}

export async function getSite(db: DB, id: string): Promise<WorkSite> {
  const { data, error } = await (db as any)
    .from('work_sites').select('*').eq('id', id).single()
  if (error) throw new AppError('SITE_NOT_FOUND', error.message, 404)
  return data
}

export async function createSite(
  db: DB,
  org_id: string,
  created_by: string,
  input: CreateSiteInput
): Promise<WorkSite> {
  const { data, error } = await (db as any)
    .from('work_sites')
    .insert({ ...input, org_id, created_by })
    .select().single()
  if (error) throw new AppError('CREATE_SITE_FAILED', error.message)
  return data
}

export async function updateSite(
  db: DB,
  id: string,
  input: Partial<CreateSiteInput> & { is_active?: boolean }
): Promise<WorkSite> {
  const { data, error } = await (db as any)
    .from('work_sites').update(input).eq('id', id).select().single()
  if (error) throw new AppError('UPDATE_SITE_FAILED', error.message)
  return data
}

// Haversine distance (meters) — for client-side validation too
export function distanceMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R    = 6371000
  const dlat = ((lat2 - lat1) * Math.PI) / 180
  const dlng = ((lng2 - lng1) * Math.PI) / 180
  const a    = Math.sin(dlat/2)**2 +
               Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
               Math.sin(dlng/2)**2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

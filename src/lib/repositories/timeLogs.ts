/**
 * Time Log Repository — v2 with photo, site, location tracking
 */
import { type SupabaseClient } from '@supabase/supabase-js'
import { type Database, type TimeLog } from '@/types/database'
import { type LocationTrack } from '@/types/tracking'
import { AppError } from '@/lib/errors'

type DB = SupabaseClient<Database>

// ─── Photo upload to storage ─────────────────────────────────
export async function uploadClockPhoto(
  db: DB,
  employee_id: string,
  blob: Blob,
  kind: 'in' | 'out'
): Promise<string> {
  const ts   = Date.now()
  const path = `clock/${employee_id}/${ts}-${kind}.jpg`

  const { error } = await db.storage
    .from('timeclock-photos')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '604800' })

  if (error) throw new AppError('PHOTO_UPLOAD_FAILED', error.message)

  const { data } = db.storage.from('timeclock-photos').getPublicUrl(path)
  return data.publicUrl
}

// ─── Today's open log ────────────────────────────────────────
export async function getTodayLog(db: DB, employee_id: string): Promise<TimeLog | null> {
  const today    = new Date()
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const dayEnd   = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1).toISOString()

  const { data, error } = await db
    .from('time_logs')
    .select('*')
    .eq('employee_id', employee_id)
    .gte('clock_in', dayStart)
    .lt('clock_in', dayEnd)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new AppError('FETCH_TIME_LOG_FAILED', error.message)
  return data
}

// ─── Clock In — requires photo + GPS ────────────────────────
export type ClockInInput = {
  org_id:      string
  employee_id: string
  coords:      { lat: number; lng: number; accuracy_m?: number }
  photo_url:   string                  // required — uploaded first
  site_id?:    string                  // optional — link to a site for geofencing
  device?:     string
  note?:       string
}

export async function clockIn(db: DB, input: ClockInInput): Promise<TimeLog> {
  // Block duplicate open session
  const { data: open } = await db
    .from('time_logs').select('id').eq('employee_id', input.employee_id)
    .is('clock_out', null).maybeSingle()

  if (open) throw new AppError('ALREADY_CLOCKED_IN',
    'มีรายการเข้างานที่ยังไม่ได้ออกอยู่แล้ว', 409)

  const { data, error } = await (db as any)
    .from('time_logs')
    .insert({
      org_id:               input.org_id,
      employee_id:          input.employee_id,
      site_id:              input.site_id ?? null,
      clock_in:             new Date().toISOString(),
      clock_in_lat:         input.coords.lat,
      clock_in_lng:         input.coords.lng,
      clock_in_accuracy_m:  input.coords.accuracy_m ?? null,
      clock_in_photo_url:   input.photo_url,
      clock_in_device:      input.device ?? null,
      note:                 input.note ?? null,
    })
    .select().single()

  if (error) throw new AppError('CLOCK_IN_FAILED', error.message)
  return data
}

// ─── Clock Out — requires photo + GPS ───────────────────────
export type ClockOutInput = {
  log_id:    string
  coords:    { lat: number; lng: number; accuracy_m?: number }
  photo_url: string
  device?:   string
}

export async function clockOut(db: DB, input: ClockOutInput): Promise<TimeLog> {
  const { data, error } = await (db as any)
    .from('time_logs')
    .update({
      clock_out:             new Date().toISOString(),
      clock_out_lat:         input.coords.lat,
      clock_out_lng:         input.coords.lng,
      clock_out_accuracy_m:  input.coords.accuracy_m ?? null,
      clock_out_photo_url:   input.photo_url,
      clock_out_device:      input.device ?? null,
    })
    .eq('id', input.log_id)
    .is('clock_out', null)        // race guard
    .select().single()

  if (error) throw new AppError('CLOCK_OUT_FAILED', error.message)
  if (!data)  throw new AppError('LOG_NOT_FOUND',
    'ไม่พบรายการเข้างาน หรือออกงานไปแล้ว', 404)
  return data
}

// ─── Location tracking ───────────────────────────────────────
export type LocationPing = {
  org_id:      string
  time_log_id: string
  employee_id: string
  lat:         number
  lng:         number
  accuracy_m?: number
  speed_mps?:  number
  battery_pct?: number
}

export async function pingLocation(db: DB, input: LocationPing): Promise<LocationTrack> {
  const { data, error } = await (db as any)
    .from('location_tracks')
    .insert({
      org_id:      input.org_id,
      time_log_id: input.time_log_id,
      employee_id: input.employee_id,
      lat:         input.lat,
      lng:         input.lng,
      accuracy_m:  input.accuracy_m   ?? null,
      speed_mps:   input.speed_mps    ?? null,
      battery_pct: input.battery_pct  ?? null,
      recorded_at: new Date().toISOString(),
    })
    .select().single()

  if (error) throw new AppError('PING_FAILED', error.message)
  return data
}

export async function getTracksForSession(
  db: DB, time_log_id: string, limit = 100
): Promise<LocationTrack[]> {
  const { data, error } = await (db as any)
    .from('location_tracks')
    .select('*')
    .eq('time_log_id', time_log_id)
    .order('recorded_at', { ascending: true })
    .limit(limit)
  if (error) throw new AppError('FETCH_TRACKS_FAILED', error.message)
  return data
}

export async function listTimeLogs(
  db: DB,
  org_id: string,
  options: { employee_id?: string; from?: string; to?: string; limit?: number }
) {
  let query = db
    .from('time_logs')
    .select('*, employee:employees(full_name, role, avatar_url)')
    .eq('org_id', org_id)
    .order('clock_in', { ascending: false })
    .limit(options.limit ?? 100)

  if (options.employee_id) query = query.eq('employee_id', options.employee_id)
  if (options.from)        query = query.gte('clock_in', options.from)
  if (options.to)          query = query.lte('clock_in', options.to)

  const { data, error } = await query
  if (error) throw new AppError('FETCH_TIME_LOGS_FAILED', error.message)
  return data
}

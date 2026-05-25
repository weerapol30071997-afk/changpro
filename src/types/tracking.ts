// ─── Extended types for v2 (tracking) ────────────────────────
// Append to existing database.ts types

export type WorkSite = {
  id:         string
  org_id:     string
  name:       string
  address:    string | null
  lat:        number
  lng:        number
  radius_m:   number
  is_active:  boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type LocationTrack = {
  id:          string
  org_id:      string
  time_log_id: string
  employee_id: string
  lat:         number
  lng:         number
  accuracy_m:  number | null
  speed_mps:   number | null
  battery_pct: number | null
  recorded_at: string
  created_at:  string
}

export type NotificationKind =
  | 'clock_in' | 'clock_out'
  | 'geofence_exit' | 'geofence_return'
  | 'long_idle'
  | 'payroll_approved' | 'payroll_paid'
  | 'job_assigned'

export type AppNotification = {
  id:           string
  org_id:       string
  recipient_id: string
  kind:         NotificationKind
  title:        string
  body:         string | null
  data:         {
    time_log_id?:   string
    employee_id?:   string
    employee_name?: string
    site_id?:       string
    site_name?:     string
    lat?:           number
    lng?:           number
    distance_m?:    number
  }
  read_at:      string | null
  created_at:   string
}

export type PushSubscription = {
  id:          string
  user_id:     string
  endpoint:    string
  p256dh:      string
  auth:        string
  user_agent:  string | null
  created_at:  string
}

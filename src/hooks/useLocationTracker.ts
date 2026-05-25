'use client'
/**
 * useLocationTracker
 * Sends GPS pings to the server at a regular interval while the employee is clocked in.
 * Pings include battery level when available.
 */
import { useEffect, useRef } from 'react'
import { useGeoWatcher, type Coords } from './useGeolocation'

const PING_INTERVAL_MS = 60_000   // every 60 seconds

export function useLocationTracker(active: boolean, time_log_id: string | null) {
  const lastSentRef    = useRef<number>(0)
  const lastCoordsRef  = useRef<Coords | null>(null)
  const batteryRef     = useRef<number | null>(null)

  // ─── Subscribe to battery level (optional, Chrome only) ────
  useEffect(() => {
    if (!active) return
    const nav = navigator as any
    if (!nav.getBattery) return
    let mounted = true
    nav.getBattery().then((b: any) => {
      if (!mounted) return
      const update = () => batteryRef.current = Math.round(b.level * 100)
      update()
      b.addEventListener('levelchange', update)
    })
    return () => { mounted = false }
  }, [active])

  // ─── Watch GPS ─────────────────────────────────────────────
  useGeoWatcher(active && !!time_log_id, coords => {
    lastCoordsRef.current = coords
  })

  // ─── Periodic ping ─────────────────────────────────────────
  useEffect(() => {
    if (!active || !time_log_id) return

    async function ping() {
      const c = lastCoordsRef.current
      if (!c) return
      const now = Date.now()
      if (now - lastSentRef.current < PING_INTERVAL_MS - 1000) return
      lastSentRef.current = now

      try {
        await fetch('/api/timeclock/ping', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            lat:         c.lat,
            lng:         c.lng,
            accuracy_m:  c.accuracy_m,
            speed_mps:   c.speed_mps ?? undefined,
            battery_pct: batteryRef.current ?? undefined,
          }),
        })
      } catch (e) {
        console.warn('ping failed', e)
      }
    }

    // Initial ping + interval
    ping()
    const id = setInterval(ping, PING_INTERVAL_MS)

    // Also ping on tab visible
    const onVis = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [active, time_log_id])
}

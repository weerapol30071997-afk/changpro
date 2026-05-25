'use client'

import { useEffect, useRef, useState } from 'react'

export type Coords = {
  lat: number
  lng: number
  accuracy_m: number
  speed_mps:  number | null
  recorded_at: number
}

export type GeoState =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'denied'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; coords: Coords }

// ─── Single fetch (for clock in/out) ─────────────────────────
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ kind: 'idle' })

  async function request(): Promise<Coords> {
    setState({ kind: 'requesting' })

    if (!('geolocation' in navigator)) {
      const msg = 'อุปกรณ์ไม่รองรับ GPS'
      setState({ kind: 'error', message: msg })
      throw new Error(msg)
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        p => {
          const c: Coords = {
            lat:        p.coords.latitude,
            lng:        p.coords.longitude,
            accuracy_m: p.coords.accuracy,
            speed_mps:  p.coords.speed,
            recorded_at: p.timestamp,
          }
          setState({ kind: 'ready', coords: c })
          resolve(c)
        },
        err => {
          const msg = err.code === err.PERMISSION_DENIED
            ? 'กรุณาอนุญาตการเข้าถึงตำแหน่ง'
            : err.code === err.POSITION_UNAVAILABLE
            ? 'ไม่สามารถระบุตำแหน่งได้ — ลองออกที่โล่ง'
            : err.code === err.TIMEOUT
            ? 'หาตำแหน่งไม่พบ (timeout)'
            : 'เกิดข้อผิดพลาด GPS'
          setState(err.code === err.PERMISSION_DENIED
            ? { kind: 'denied', message: msg }
            : { kind: 'error',  message: msg })
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    })
  }

  return { state, request }
}

// ─── Background watcher (for live tracking while clocked in) ──
export function useGeoWatcher(active: boolean, onUpdate: (c: Coords) => void) {
  const watchIdRef = useRef<number | null>(null)
  const callbackRef = useRef(onUpdate)
  callbackRef.current = onUpdate

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }
    if (!('geolocation' in navigator)) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      p => callbackRef.current({
        lat:        p.coords.latitude,
        lng:        p.coords.longitude,
        accuracy_m: p.coords.accuracy,
        speed_mps:  p.coords.speed,
        recorded_at: p.timestamp,
      }),
      err => console.warn('watch error', err),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 }
    )
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [active])
}

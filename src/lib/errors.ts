/**
 * Application error class and API response utilities
 */
import { NextResponse } from 'next/server'

// ─── Error class ──────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// ─── API response helpers ──────────────────────────────────────
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status })
}

export function created<T>(data: T) {
  return ok(data, 201)
}

export function err(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    )
  }
  console.error('[Unhandled]', error)
  return NextResponse.json(
    { ok: false, code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
    { status: 500 }
  )
}

// ─── Auth guard for API routes ────────────────────────────────
import { createServerSupabase } from '@/lib/supabase'

export async function requireAuth() {
  const db = await createServerSupabase()
  const { data: { user }, error } = await db.auth.getUser()
  if (error || !user) throw new AppError('UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ', 401)

  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) throw new AppError('PROFILE_NOT_FOUND', 'ไม่พบข้อมูลผู้ใช้', 404)
  return { user, profile, db }
}

export async function requireRole(...roles: string[]) {
  const ctx = await requireAuth()
  if (!roles.includes(ctx.profile.role)) {
    throw new AppError('FORBIDDEN', 'ไม่มีสิทธิ์เข้าถึง', 403)
  }
  return ctx
}

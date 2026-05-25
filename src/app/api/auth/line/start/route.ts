/**
 * POST /api/auth/line/start
 * Initiates LINE Login OAuth 2.0 flow (PKCE) and returns redirect URL.
 * LINE doesn't use OIDC discovery — we hardcode the authorization endpoint.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize'

export async function POST(req: NextRequest) {
  const clientId = process.env.LINE_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ ok: false, message: 'LINE Client ID ยังไม่ได้ตั้งค่า' }, { status: 503 })
  }

  const { redirectTo } = await req.json()
  const state          = crypto.randomBytes(16).toString('hex')
  const nonce          = crypto.randomBytes(16).toString('hex')

  // Store state in httpOnly cookie for CSRF check on callback
  const jar = await cookies()
  jar.set('line_oauth_state', state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600,
  })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectTo,
    state,
    scope:         'profile openid email',
    nonce,
  })

  return NextResponse.json({ ok: true, url: `${LINE_AUTH_URL}?${params}` })
}

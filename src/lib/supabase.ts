import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { type ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import { type Database } from '@/types/database'

// ─── Browser client (singleton) ──────────────────────────────
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}

// ─── Server client (per-request, reads cookies) ──────────────
export function getSupabaseServerClient(cookieStore: ReadonlyRequestCookies) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:    () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // @ts-ignore
              cookieStore.set(name, value, options)
            )
          } catch {
            // read-only in Server Components — middleware handles refresh
          }
        },
      },
    }
  )
}

// ─── Service-role client (admin operations, server-only) ─────
export function getSupabaseAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Convenience: server client from next/headers (lazy import) ──
export async function createServerSupabase() {
  // Lazy import prevents "not supported in pages/" error at module load
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return getSupabaseServerClient(cookieStore)
}

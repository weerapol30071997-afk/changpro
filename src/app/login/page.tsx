'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/dashboard'
  const [loading, setLoading]   = useState<string | null>(null)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mode, setMode]         = useState<'oauth' | 'email'>('oauth')

  const supabase = getSupabaseBrowserClient()

  async function signInWithOAuth(provider: 'google' | 'line') {
    setLoading(provider)
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      if (provider === 'line') {
        const res = await fetch('/api/auth/line/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ redirectTo }),
        })
        const json = await res.json()
        if (json.url) { window.location.href = json.url; return }
        throw new Error(json.error ?? 'LINE login failed')
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (error) throw error
    } catch (e: any) {
      toast.error(e.message)
      setLoading(null)
    }
  }

  async function signInWithEmail() {
    if (!email || !password) return toast.error('กรุณากรอก Email และ Password')
    setLoading('email')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(next)
      router.refresh()
    } catch (e: any) {
      toast.error('Email หรือ Password ไม่ถูกต้อง')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800
      flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔧</span>
          </div>
          <h1 className="text-3xl font-black text-white">ช่างโปร</h1>
          <p className="text-blue-200 text-sm mt-1">ระบบจัดการธุรกิจช่างครบวงจร</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 shadow-2xl">

          {mode === 'oauth' ? (
            <>
              <h2 className="font-black text-xl text-center mb-6">เข้าสู่ระบบ</h2>

              {/* Google */}
              <button onClick={() => signInWithOAuth('google')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 border-2 border-gray-200
                  rounded-2xl p-4 font-bold text-gray-700 hover:bg-gray-50 transition-colors mb-3">
                {loading === 'google'
                  ? <Loader2 className="animate-spin" size={20}/>
                  : <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google"/>}
                เข้าสู่ระบบด้วย Google
              </button>

              {/* LINE */}
              <button onClick={() => signInWithOAuth('line')}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-3 rounded-2xl p-4
                  font-bold text-white transition-colors mb-4"
                style={{ background: '#06c755' }}>
                {loading === 'line' ? <Loader2 className="animate-spin" size={20}/> : <span className="text-xl">💬</span>}
                เข้าสู่ระบบด้วย LINE
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"/>
                </div>
                <div className="relative flex justify-center text-xs text-gray-400">
                  <span className="bg-white px-3">หรือ</span>
                </div>
              </div>

              {/* Switch to email */}
              <button onClick={() => setMode('email')}
                className="w-full flex items-center justify-center gap-2 text-blue-600
                  font-bold p-3 rounded-2xl hover:bg-blue-50 transition-colors">
                <Mail size={18}/>
                เข้าสู่ระบบด้วย Email / Password
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setMode('oauth')}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg">←</button>
                <h2 className="font-black text-xl">Email / Password</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                      placeholder="your@email.com"
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-4 py-3
                        text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && signInWithEmail()}
                      placeholder="••••••••"
                      className="w-full border-2 border-gray-200 rounded-xl pl-9 pr-10 py-3
                        text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                <button onClick={signInWithEmail}
                  disabled={loading === 'email'}
                  className="w-full bg-blue-600 text-white font-black rounded-2xl p-4
                    flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors mt-2">
                  {loading === 'email'
                    ? <Loader2 className="animate-spin" size={20}/>
                    : '🔐'}
                  เข้าสู่ระบบ
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">
          ช่างโปร Enterprise v7 · Powered by Supabase
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm/>
    </Suspense>
  )
}

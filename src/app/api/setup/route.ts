import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'

export async function GET() {
  try {
    const admin = getSupabaseAdminClient()
    const email = 'weerapol30071997@gmail.com'
    const password = 'Password123'

    // หา user เดิม
    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users?.find(u => u.email === email)

    let uid: string

    if (existing) {
      // อัปเดต password
      await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      })
      uid = existing.id
    } else {
      // สร้างใหม่
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Admin' }
      })
      if (error) return NextResponse.json({ error: error.message })
      uid = data.user.id
    }

    // ตั้ง profile + admin
    await admin.from('profiles').upsert({
      id: uid,
      org_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'Admin',
      role: 'admin'
    })

    return NextResponse.json({ 
      ok: true, 
      uid,
      email,
      password,
      note: 'Use this password to login'
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message })
  }
}

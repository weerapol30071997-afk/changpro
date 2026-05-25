import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const db = await createServerSupabase()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await db
    .from('profiles')
    .select('*, employee:employees(id, full_name, role, avatar_url, color:role)')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // First-time login: profile not created yet, redirect to onboarding
    redirect('/onboarding')
  }

  return <DashboardShell profile={profile}>{children}</DashboardShell>
}

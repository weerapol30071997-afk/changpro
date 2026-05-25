'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  LayoutDashboard, Users, Clock, Wrench, Wallet, MapPin,
  LogOut, Menu, X, ChevronRight, Home, Briefcase, Receipt, Map,
  UserCheck, Package, BookText, BarChart3, Settings, Calendar, ChevronDown,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { Profile } from '@/types/database'

// ─── Navigation menu (grouped) ────────────────────────────────
const ADMIN_GROUPS = [
  {
    name: 'หลัก',
    items: [
      { href: '/dashboard', label: 'ภาพรวม',  icon: LayoutDashboard },
      { href: '/jobs',      label: 'งาน',     icon: Wrench },
      { href: '/timeclock', label: 'ลงเวลา',  icon: Clock },
    ],
  },
  {
    name: 'จัดการ',
    items: [
      { href: '/employees', label: 'ช่าง',      icon: Users },
      { href: '/customers', label: 'ลูกค้า',   icon: UserCheck },
      { href: '/services',  label: 'บริการ',  icon: BookText },
      { href: '/materials', label: 'วัสดุ',    icon: Package },
    ],
  },
  {
    name: 'การเงิน & ลา',
    items: [
      { href: '/salary',    label: 'เงินเดือน', icon: Wallet },
      { href: '/leaves',    label: 'การลา',     icon: Calendar },
      { href: '/holidays',  label: 'วันหยุด',  icon: Calendar },
    ],
  },
  {
    name: 'ติดตาม',
    items: [
      { href: '/gps',       label: 'ติดตาม GPS', icon: MapPin },
      { href: '/sites',     label: 'พื้นที่',     icon: Map },
    ],
  },
  {
    name: 'รายงาน & ระบบ',
    items: [
      { href: '/reports',  label: 'รายงาน',    icon: BarChart3 },
      { href: '/settings', label: 'ตั้งค่า',    icon: Settings },
    ],
  },
]

const EMP_GROUPS = [
  {
    name: 'งานของฉัน',
    items: [
      { href: '/dashboard', label: 'หน้าหลัก', icon: Home },
      { href: '/timeclock', label: 'ลงเวลา',   icon: Clock },
      { href: '/jobs',      label: 'งาน',       icon: Briefcase },
    ],
  },
  {
    name: 'การเงิน & ลา',
    items: [
      { href: '/salary',   label: 'สลิป',     icon: Receipt },
      { href: '/leaves',   label: 'ลางาน',   icon: Calendar },
    ],
  },
]

// Bottom nav items (mobile, max 5)
const ADMIN_BOTTOM = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: Home },
  { href: '/jobs',      label: 'งาน',      icon: Wrench },
  { href: '/employees', label: 'ช่าง',     icon: Users },
  { href: '/salary',    label: 'เงิน',     icon: Wallet },
  { href: '/reports',   label: 'รายงาน',   icon: BarChart3 },
]

const EMP_BOTTOM = [
  { href: '/dashboard', label: 'หน้าหลัก', icon: Home },
  { href: '/timeclock', label: 'ลงเวลา',  icon: Clock },
  { href: '/jobs',      label: 'งาน',      icon: Briefcase },
  { href: '/salary',    label: 'สลิป',     icon: Receipt },
  { href: '/leaves',    label: 'ลา',        icon: Calendar },
]

export function DashboardShell({
  profile,
  children,
}: {
  profile: Profile & { employee?: any }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = getSupabaseBrowserClient()

  const isAdmin    = profile.role === 'admin' || profile.role === 'manager'
  const groups     = isAdmin ? ADMIN_GROUPS : EMP_GROUPS
  const bottomNav  = isAdmin ? ADMIN_BOTTOM : EMP_BOTTOM
  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('ออกจากระบบแล้ว')
    router.push('/login')
  }

  return (
    <div className="min-h-dvh flex">
      {/* ─── Desktop sidebar ─── */}
      <aside className="hidden md:flex flex-col w-60 fixed inset-y-0 left-0 bg-slate-900 z-30 overflow-y-auto">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div className="text-xl font-black text-white">🔩 ช่างโปร</div>
            <div className="text-xs text-slate-400 mt-1">ระบบจัดการช่าง</div>
          </div>
          {isAdmin && <div className="text-white"><NotificationBell userId={profile.id} orgId={profile.org_id}/></div>}
        </div>

        <nav className="flex-1 pt-2">
          {groups.map(group => (
            <div key={group.name} className="mb-2">
              <div className="px-5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {group.name}
              </div>
              {group.items.map(item => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                      ${active
                        ? 'bg-blue-600/20 text-white border-l-2 border-blue-500 font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800 border-l-2 border-transparent'}`}>
                    <Icon size={16}/>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center
              text-white font-black text-sm shrink-0">
              {profile.full_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{profile.full_name}</div>
              <div className="text-[10px] text-slate-400">
                {profile.role === 'admin' ? 'ผู้ดูแลระบบ' : profile.role === 'manager' ? 'หัวหน้า' : 'พนักงาน'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg
              text-xs font-bold text-red-300 bg-red-500/15 hover:bg-red-500/25 transition-colors">
            <LogOut size={14}/> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ─── Mobile top bar ─── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-gray-100 px-4 py-3
        flex items-center justify-between" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        <div className="font-black text-lg">🔩 ช่างโปร</div>
        <div className="flex items-center gap-1">
          {isAdmin && <NotificationBell userId={profile.id} orgId={profile.org_id}/>}
          <button onClick={() => setMobileOpen(true)} className="p-2 -mr-2"><Menu size={22}/></button>
        </div>
      </header>

      {/* ─── Mobile drawer ─── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 fade-in" onClick={() => setMobileOpen(false)}>
          <aside className="absolute right-0 top-0 bottom-0 w-72 bg-slate-900 slide-up flex flex-col overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between sticky top-0 bg-slate-900">
              <div>
                <div className="text-lg font-black text-white">🔩 ช่างโปร</div>
                <div className="text-xs text-slate-400">{profile.full_name}</div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-slate-400 p-2 -mr-2"><X size={20}/></button>
            </div>
            <nav className="flex-1">
              {groups.map(group => (
                <div key={group.name} className="mb-2">
                  <div className="px-5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {group.name}
                  </div>
                  {group.items.map(item => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-5 py-2.5 text-sm
                          ${active ? 'bg-blue-600/20 text-white font-bold' : 'text-slate-400'}`}>
                        <Icon size={16}/>{item.label}
                        <ChevronRight size={14} className="ml-auto opacity-50"/>
                      </Link>
                    )
                  })}
                </div>
              ))}
            </nav>
            <button onClick={handleLogout}
              className="m-4 flex items-center justify-center gap-2 py-3 rounded-xl
                text-sm font-bold text-red-300 bg-red-500/15 shrink-0">
              <LogOut size={14}/> ออกจากระบบ
            </button>
          </aside>
        </div>
      )}

      {/* ─── Main content ─── */}
      <main className="flex-1 md:ml-60 pt-[64px] md:pt-0 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {children}
        </div>
      </main>

      {/* ─── Mobile bottom nav (5 items) ─── */}
      <nav className="md:hidden bottom-nav flex">
        {bottomNav.map(item => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link key={item.href} href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px]">
              <Icon size={20} className={active ? 'text-blue-600' : 'text-gray-400'}/>
              <span className={`text-[10px] ${active ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

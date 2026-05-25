'use client'
/**
 * Main Dashboard — comprehensive at-a-glance view for admin & employees.
 * Different views per role.
 */
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  Users, Briefcase, Clock, Wallet, AlertTriangle, Star,
  CheckCircle, TrendingUp, MapPin, Calendar, Package, Award,
  ChevronRight, Activity, DollarSign,
} from 'lucide-react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thb     = (n: number) => new Intl.NumberFormat('th-TH').format(n)
const thbK    = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(Math.round(n))

export default function DashboardPage() {
  const [me, setMe] = useState<{ role: string; full_name: string; employee_id: string | null } | null>(null)
  useEffect(() => { fetch('/api/profile').then(r => r.json()).then(j => { if (j.ok) setMe(j.data) }) }, [])

  const isAdmin = me?.role === 'admin' || me?.role === 'manager'
  return isAdmin ? <AdminDashboard me={me!}/> : <EmployeeDashboard me={me}/>
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────
function AdminDashboard({ me }: any) {
  const { data: overview }    = useSWR<any>('/api/analytics?kind=overview', fetcher)
  const { data: revenue = [] } = useSWR<any[]>(`/api/analytics?kind=revenue&year=${new Date().getFullYear()}`, fetcher)
  const { data: top5 = [] }    = useSWR<any[]>('/api/analytics?kind=performance', fetcher)
  const { data: jobs = [] }    = useSWR<any[]>('/api/jobs?limit=100', fetcher)
  const { data: timeData }    = useSWR<any>('/api/timeclock?limit=50', fetcher)
  const { data: lowStock = [] } = useSWR<any[]>('/api/materials?low_stock=1', fetcher)
  const { data: pendingLeaves = [] } = useSWR<any[]>('/api/leaves?status=pending', fetcher)
  const { data: employees = [] } = useSWR<any[]>('/api/employees', fetcher)

  const livingNow   = (timeData?.logs ?? []).filter((l: any) => l.clock_in && !l.clock_out)
  const todaysJobs  = jobs.filter(j => {
    const d = new Date(j.created_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  })
  const unassigned = jobs.filter(j => !j.assigned_to && ['pending','rejected'].includes(j.status))
  const awaiting   = jobs.filter(j => j.status === 'awaiting_inspection')

  const yearRevenue = revenue.reduce((s, r) => s + Number(r.revenue || 0), 0)
  const yearJobs    = revenue.reduce((s, r) => s + Number(r.jobs_count || 0), 0)

  // Chart data
  const chartData = revenue.map(r => ({
    month: format(new Date(r.month + '-01'), 'MMM', { locale: th }),
    revenue: Number(r.revenue || 0),
    profit:  Number(r.profit  || 0),
  }))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black">สวัสดี {me?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}</p>
      </div>

      {/* Hero KPI banner */}
      <div className="rounded-3xl p-5 mb-4 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0a0f1e,#1a3a8f,#3b82f6)' }}>
        <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"/>
        <div className="absolute right-10 bottom-0 w-20 h-20 bg-white/5 rounded-full"/>
        <div className="relative">
          <div className="text-xs text-white/70">รายได้ปี {new Date().getFullYear()}</div>
          <div className="text-3xl font-black mt-1">{thb(yearRevenue)} ฿</div>
          <div className="flex gap-4 mt-3 text-xs">
            <div>📋 {yearJobs} งาน</div>
            <div>⭐ {(overview?.avg_rating ?? 0).toFixed(1)}</div>
            <div>👷 {employees.length} ช่าง</div>
            <div>🟢 {livingNow.length} กำลังทำงาน</div>
          </div>
        </div>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <StatCard icon={<Users size={20}/>}     label="พนักงาน"    value={employees.length}                                href="/employees"
          color="text-blue-600" bg="bg-blue-50"/>
        <StatCard icon={<Briefcase size={20}/>} label="งานวันนี้"   value={todaysJobs.length}                              href="/jobs"
          color="text-purple-600" bg="bg-purple-50"/>
        <StatCard icon={<AlertTriangle size={20}/>} label="รอตรวจ" value={awaiting.length}    href="/jobs?status=awaiting_inspection"
          color="text-amber-600" bg="bg-amber-50" alert={awaiting.length > 0}/>
        <StatCard icon={<Calendar size={20}/>}  label="คำขอลา"      value={pendingLeaves.length}  href="/leaves"
          color="text-red-600" bg="bg-red-50" alert={pendingLeaves.length > 0}/>
      </div>

      {/* Critical alerts */}
      {(unassigned.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2 mb-4">
          {unassigned.length > 0 && (
            <Link href="/jobs"
              className="card border-2 border-purple-200 bg-purple-50/50 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                ⚡
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">มี {unassigned.length} งานรอมอบหมาย</div>
                <div className="text-xs text-purple-700">กดเพื่อจัดการ</div>
              </div>
              <ChevronRight size={16} className="text-purple-600"/>
            </Link>
          )}
          {lowStock.length > 0 && (
            <Link href="/materials"
              className="card border-2 border-red-200 bg-red-50/50 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                <Package size={18}/>
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">วัสดุใกล้หมด {lowStock.length} รายการ</div>
                <div className="text-xs text-red-700">ต้องสั่งซื้อเพิ่ม</div>
              </div>
              <ChevronRight size={16} className="text-red-600"/>
            </Link>
          )}
        </div>
      )}

      {/* Revenue chart */}
      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600"/> รายได้รายเดือน
          </h3>
          <Link href="/reports" className="text-xs text-blue-600 font-bold">ดูเพิ่มเติม →</Link>
        </div>
        {chartData.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-xs">ยังไม่มีข้อมูลรายได้</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ left: -20, right: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
              <XAxis dataKey="month" fontSize={11}/>
              <YAxis fontSize={11} tickFormatter={thbK}/>
              <Tooltip formatter={(v: any) => `${thb(Number(v))} ฿`} contentStyle={{ fontSize: 12 }}/>
              <Bar dataKey="revenue" fill="#3b82f6" radius={[6,6,0,0]} name="รายได้"/>
              <Bar dataKey="profit"  fill="#10b981" radius={[6,6,0,0]} name="กำไร"/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top performers + Active employees */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Top performers */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Award size={16} className="text-amber-500"/> ช่างยอดเยี่ยม
            </h3>
            <Link href="/reports" className="text-xs text-blue-600 font-bold">ดูทั้งหมด</Link>
          </div>
          {top5.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-1.5">
              {top5.slice(0, 5).map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center text-white ${
                    i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-blue-500'
                  }`}>
                    {i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{p.full_name}</div>
                    <div className="text-[10px] text-gray-500">
                      {p.total_jobs_done} งาน {p.avg_rating && `· ⭐ ${Number(p.avg_rating).toFixed(1)}`}
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-blue-600">{thbK(p.total_revenue_earned || 0)} ฿</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live working */}
        <div className="card p-4">
          <h3 className="font-bold text-sm flex items-center gap-2 mb-3">
            <Activity size={16} className="text-green-500"/> กำลังทำงานตอนนี้ ({livingNow.length})
          </h3>
          {livingNow.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">ยังไม่มีพนักงานเข้างาน</p>
          ) : (
            <div className="space-y-1.5">
              {livingNow.slice(0, 5).map((l: any) => (
                <Link key={l.id} href="/gps"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white text-xs font-black
                      flex items-center justify-center">
                      {l.employee?.full_name?.[0]}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full
                      border-2 border-white animate-pulse"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{l.employee?.full_name}</div>
                    <div className="text-[10px] text-gray-500">
                      เข้างาน {format(new Date(l.clock_in), 'HH:mm')}
                    </div>
                  </div>
                  <MapPin size={14} className="text-gray-300"/>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { href: '/jobs',      icon: '🔧', label: 'งาน' },
          { href: '/customers', icon: '👥', label: 'ลูกค้า' },
          { href: '/services',  icon: '📋', label: 'บริการ' },
          { href: '/materials', icon: '📦', label: 'วัสดุ' },
          { href: '/leaves',    icon: '🏖', label: 'ลา' },
          { href: '/reports',   icon: '📊', label: 'รายงาน' },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="card p-3 text-center hover:bg-gray-50 transition-colors">
            <div className="text-2xl mb-1">{l.icon}</div>
            <div className="text-[11px] font-bold text-gray-700">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── EMPLOYEE DASHBOARD ───────────────────────────────────────
function EmployeeDashboard({ me }: any) {
  const { data: jobs = [] }     = useSWR<any[]>('/api/jobs', fetcher)
  const { data: timeData }     = useSWR<any>('/api/timeclock?limit=10', fetcher)
  const { data: payrollData } = useSWR<any>('/api/payroll', fetcher)
  const { data: leaves = [] }  = useSWR<any[]>('/api/leaves?mine=1', fetcher)

  const todayLog = timeData?.today_log
  const isClockedIn = todayLog && !todayLog.clock_out
  const myJobs     = jobs.filter(j => ['pending','inprogress','rejected'].includes(j.status))
  const recentPay  = (payrollData?.periods ?? []).slice(0, 3)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">สวัสดี {me?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: th })}</p>
      </div>

      {/* Clock status hero */}
      <Link href="/timeclock"
        className={`block rounded-3xl p-5 text-white relative overflow-hidden ${
          isClockedIn ? 'bg-gradient-to-br from-green-500 to-emerald-700' : 'bg-gradient-to-br from-gray-700 to-gray-900'
        }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-white/70">{isClockedIn ? 'กำลังทำงาน' : 'ยังไม่ได้เข้างาน'}</div>
            <div className="text-3xl font-black mt-1">
              {isClockedIn ? '🟢 ' + format(new Date(todayLog.clock_in), 'HH:mm') : '⏰ —:—'}
            </div>
            <div className="text-xs text-white/70 mt-1">
              {isClockedIn ? 'กดเพื่อออกงาน' : 'กดเพื่อเข้างาน'}
            </div>
          </div>
          <Clock size={48} className="text-white/30"/>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={<Briefcase size={18}/>} label="งานที่ทำ" value={myJobs.length} href="/jobs"
          color="text-blue-600" bg="bg-blue-50"/>
        <StatCard icon={<Wallet size={18}/>} label="สลิป" value={recentPay.length} href="/salary"
          color="text-green-600" bg="bg-green-50"/>
        <StatCard icon={<Calendar size={18}/>} label="ใบลา" value={leaves.length} href="/leaves"
          color="text-amber-600" bg="bg-amber-50"/>
      </div>

      {myJobs.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">📋 งานของฉัน</h3>
            <Link href="/jobs" className="text-xs text-blue-600 font-bold">ดูทั้งหมด</Link>
          </div>
          <div className="space-y-1.5">
            {myJobs.slice(0, 4).map(j => (
              <Link key={j.id} href={`/jobs?id=${j.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{j.title}</div>
                  <div className="text-[10px] text-gray-500 truncate">{j.location ?? '—'}</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  j.status === 'pending' ? 'bg-gray-100 text-gray-700' :
                  j.status === 'inprogress' ? 'bg-blue-100 text-blue-700' :
                                              'bg-red-100 text-red-700'
                }`}>
                  {j.status === 'pending' ? 'รอเริ่ม' :
                   j.status === 'inprogress' ? 'กำลังทำ' : 'ตีกลับ'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {recentPay.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-3">💰 สลิปล่าสุด</h3>
          <div className="space-y-2">
            {recentPay.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-xs font-bold">
                    {format(new Date(p.period_from), 'd MMM', { locale: th })} —
                    {format(new Date(p.period_to), ' d MMM', { locale: th })}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {p.status === 'paid' ? '✅ จ่ายแล้ว' : '⏳ ' + p.status}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-blue-700">{thb(Number(p.net_amount))} ฿</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────
function StatCard({ icon, label, value, href, color, bg, alert }: any) {
  const inner = (
    <div className={`card p-3 relative ${alert ? 'ring-2 ring-red-400 animate-pulse' : ''}`}>
      <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className={`font-black text-lg ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

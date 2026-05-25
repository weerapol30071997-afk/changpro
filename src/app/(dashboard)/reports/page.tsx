'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  TrendingUp, DollarSign, Wrench, Users, Award, Star,
  Download, Calendar as CalIcon, Trophy,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => j.data)
const thbN    = (n: number) => new Intl.NumberFormat('th-TH').format(Math.round(n))

const COLORS = ['#1e6fff','#00c97a','#ffa629','#ff3d5a','#7c5cfc','#06c755','#ec4899','#0ea5e9']

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: revenue }     = useSWR<any[]>(`/api/analytics?kind=revenue&year=${year}`, fetcher)
  const { data: performance } = useSWR<any[]>('/api/analytics?kind=performance', fetcher)
  const { data: customers }   = useSWR<any[]>('/api/customers?limit=100', fetcher)

  const totalRevenue = (revenue ?? []).reduce((s, r) => s + Number(r.revenue || 0), 0)
  const totalProfit  = (revenue ?? []).reduce((s, r) => s + Number(r.profit  || 0), 0)
  const totalJobs    = (revenue ?? []).reduce((s, r) => s + Number(r.jobs_count || 0), 0)
  const margin       = totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0

  const chartData = (revenue ?? []).map(r => ({
    month:    r.month?.slice(5) ?? '',
    รายได้:    Math.round(Number(r.revenue || 0)),
    กำไร:     Math.round(Number(r.profit  || 0)),
    ต้นทุน:    Math.round(Number(r.materials_cost || 0) + Number(r.labor_cost || 0)),
    งาน:      r.jobs_count ?? 0,
  }))

  // Top customers by tier
  const tiers = (customers ?? []).reduce((acc: any, c: any) => {
    const tier = c.tier ?? (c.total_revenue >= 100000 ? 'platinum'
                          : c.total_revenue >=  30000 ? 'gold'
                          : c.total_revenue >=   5000 ? 'silver' : 'bronze')
    acc[tier] = (acc[tier] || 0) + 1
    return acc
  }, {})
  const tierChart = Object.entries(tiers).map(([k, v]) => ({ name: k, value: v }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">รายงาน</h1>
          <p className="text-sm text-gray-500">ข้อมูลสรุป สำหรับวางแผนธุรกิจ</p>
        </div>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="input w-32">
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>ปี {y + 543}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KPI icon={DollarSign} label="รายได้รวม"    value={`฿ ${thbN(totalRevenue)}`} color="from-blue-500 to-blue-600"/>
        <KPI icon={TrendingUp} label="กำไรรวม"      value={`฿ ${thbN(totalProfit)}`} color="from-green-500 to-emerald-600"/>
        <KPI icon={Wrench}     label="งานที่เสร็จ" value={totalJobs.toString()}      color="from-purple-500 to-purple-600"/>
        <KPI icon={Award}      label="Margin"        value={`${margin.toFixed(1)}%`}  color="from-amber-500 to-orange-600"/>
      </div>

      {/* Revenue chart */}
      <div className="card p-4">
        <h3 className="font-bold text-sm mb-3">💰 รายได้ vs ต้นทุน vs กำไร รายเดือน</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="month" tick={{ fontSize: 10 }}/>
            <YAxis tick={{ fontSize: 10 }} tickFormatter={n => `${(n/1000).toFixed(0)}k`}/>
            <Tooltip formatter={(v: number) => `฿ ${thbN(v)}`}/>
            <Legend wrapperStyle={{ fontSize: 11 }}/>
            <Bar dataKey="รายได้" fill="#1e6fff" radius={[4,4,0,0]}/>
            <Bar dataKey="ต้นทุน" fill="#ff3d5a" radius={[4,4,0,0]}/>
            <Bar dataKey="กำไร"  fill="#00c97a" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Jobs trend */}
      <div className="card p-4">
        <h3 className="font-bold text-sm mb-3">📈 จำนวนงานรายเดือน</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
            <XAxis dataKey="month" tick={{ fontSize: 10 }}/>
            <YAxis tick={{ fontSize: 10 }}/>
            <Tooltip/>
            <Line type="monotone" dataKey="งาน" stroke="#7c5cfc" strokeWidth={3} dot={{ r: 4 }}/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top performers */}
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-amber-500"/> ช่างยอดเยี่ยม
          </h3>
          <div className="space-y-2">
            {(performance ?? []).slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-sm
                  ${i === 0 ? 'bg-amber-400 text-white'
                   : i === 1 ? 'bg-gray-300 text-gray-700'
                   : i === 2 ? 'bg-orange-300 text-orange-900'
                   :            'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-xs truncate">{p.full_name}</div>
                  <div className="text-[10px] text-gray-500">
                    {p.total_jobs_done} งาน · {p.success_rate_pct ?? 0}% สำเร็จ
                  </div>
                </div>
                {p.avg_rating && (
                  <div className="text-xs font-bold flex items-center gap-1">
                    <Star size={11} className="text-amber-400 fill-amber-400"/>
                    {Number(p.avg_rating).toFixed(1)}
                  </div>
                )}
              </div>
            ))}
            {(performance ?? []).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Customer tiers */}
        <div className="card p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Users size={16} className="text-blue-500"/> ลูกค้าแยกตามมูลค่า
          </h3>
          {tierChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={tierChart} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={70} label={(e) => `${e.name}: ${e.value}`}>
                  {tierChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-gray-400 text-center py-12">ยังไม่มีลูกค้า</p>
          )}
        </div>
      </div>

      {/* Export hint */}
      <div className="text-center text-xs text-gray-400 py-4">
        💡 ใช้ปุ่ม Print ของเบราว์เซอร์เพื่อ export PDF · เร็วๆ นี้จะมี export CSV
      </div>
    </div>
  )
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className={`rounded-2xl p-4 text-white bg-gradient-to-br ${color}`}>
      <Icon size={20} className="opacity-70 mb-1"/>
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-black text-xl mt-0.5 leading-tight">{value}</div>
    </div>
  )
}

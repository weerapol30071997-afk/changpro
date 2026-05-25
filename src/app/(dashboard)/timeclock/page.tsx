import { ClockCard } from '@/components/timeclock/ClockCard'

export default function TimeclockPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-black mb-4">ลงเวลา</h1>
      <ClockCard/>
    </div>
  )
}

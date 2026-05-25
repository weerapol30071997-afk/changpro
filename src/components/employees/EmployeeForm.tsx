'use client'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export function EmployeeForm({ initial, onSuccess, onClose }: any) {
  const supabase = getSupabaseBrowserClient()

  return (
    <div className="p-6">
      <h2 className="font-black text-lg mb-4">
        {initial ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
      </h2>
      <p className="text-gray-500">กรุณา reload หน้าจอ</p>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose}
          className="px-4 py-2 border rounded-xl">ปิด</button>
      </div>
    </div>
  )
}

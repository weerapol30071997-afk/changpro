'use client'
/**
 * PhotoUploader — multi-photo capture/upload with preview grid.
 * - Uses CameraCapture for native camera flow OR file picker fallback
 * - Shows thumbnails with remove button
 * - Returns Blob[] when committed
 */
import { useState, useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'
import { CameraCapture } from '@/components/timeclock/CameraCapture'

type Props = {
  label?:      string
  photos:      { blob: Blob; url: string }[]
  onChange:    (photos: { blob: Blob; url: string }[]) => void
  maxPhotos?:  number
  required?:   boolean
}

export function PhotoUploader({ label, photos, onChange, maxPhotos = 10, required }: Props) {
  const [showCamera, setShowCamera] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function add(blob: Blob, url: string) {
    if (photos.length >= maxPhotos) return
    onChange([...photos, { blob, url }])
  }

  function remove(idx: number) {
    URL.revokeObjectURL(photos[idx].url)
    onChange(photos.filter((_, i) => i !== idx))
  }

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const next  = [...photos]
    for (const f of files) {
      if (next.length >= maxPhotos) break
      next.push({ blob: f, url: URL.createObjectURL(f) })
    }
    onChange(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  const canAdd = photos.length < maxPhotos

  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-700">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          <span className="text-[10px] text-gray-400">{photos.length}/{maxPhotos} รูป</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
            <img src={p.url} alt="" className="w-full h-full object-cover"/>
            <button type="button" onClick={() => remove(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white
                flex items-center justify-center text-xs">
              <X size={14}/>
            </button>
            <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
              {i+1}
            </div>
          </div>
        ))}

        {canAdd && (
          <>
            <button type="button" onClick={() => setShowCamera(true)}
              className="aspect-square rounded-xl border-2 border-dashed border-blue-300 bg-blue-50
                flex flex-col items-center justify-center gap-1 text-blue-600 active:bg-blue-100">
              <Camera size={20}/>
              <span className="text-[10px] font-bold">ถ่ายภาพ</span>
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
                flex flex-col items-center justify-center gap-1 text-gray-500 active:bg-gray-100">
              <ImagePlus size={20}/>
              <span className="text-[10px] font-bold">เลือกรูป</span>
            </button>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple
        onChange={onFiles} className="hidden"/>

      {showCamera && (
        <CameraCapture
          onCapture={(blob, url) => { add(blob, url); setShowCamera(false) }}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}

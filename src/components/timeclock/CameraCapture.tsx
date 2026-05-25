'use client'
/**
 * CameraCapture — mobile-first camera with mandatory photo capture.
 * - Uses getUserMedia (back camera by default)
 * - Falls back to <input capture="environment"> if denied
 * - Returns JPEG blob (max 1280px, quality 0.8)
 */
import { useEffect, useRef, useState } from 'react'
import { Camera, RotateCcw, X, AlertTriangle } from 'lucide-react'

type Props = {
  onCapture: (blob: Blob, previewUrl: string) => void
  onCancel:  () => void
  facing?:   'user' | 'environment'
}

export function CameraCapture({ onCapture, onCancel, facing = 'environment' }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const [stream, setStream]   = useState<MediaStream | null>(null)
  const [error,  setError]    = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [currentFacing, setCurrentFacing] = useState<'user'|'environment'>(facing)

  // ── Start camera
  useEffect(() => {
    let active = true
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: currentFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (!active) { s.getTracks().forEach(t => t.stop()); return }
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          await videoRef.current.play().catch(() => {})
        }
      } catch (e: any) {
        setError(e.message ?? 'ไม่สามารถเปิดกล้องได้')
      }
    }
    start()
    return () => {
      active = false
      stream?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line
  }, [currentFacing])

  // ── Capture
  function capture() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const maxW = 1280
    const ratio = Math.min(1, maxW / video.videoWidth)
    canvas.width  = video.videoWidth  * ratio
    canvas.height = video.videoHeight * ratio
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Add timestamp watermark
    const ts = new Date().toLocaleString('th-TH')
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, canvas.height - 32, canvas.width, 32)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px sans-serif'
    ctx.fillText('📍 ' + ts, 10, canvas.height - 10)

    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      setPreview(url)
      setPreviewBlob(blob)
    }, 'image/jpeg', 0.82)
  }

  // ── File fallback
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    setPreviewBlob(file)
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setPreviewBlob(null)
  }

  function confirm() {
    if (previewBlob && preview) onCapture(previewBlob, preview)
  }

  // ── Permission error: fall back to file input
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
        <div className="p-4 flex justify-between items-center">
          <button onClick={onCancel} className="text-white p-2"><X size={22}/></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center text-white">
          <AlertTriangle size={48} className="text-amber-400 mb-4"/>
          <h3 className="font-bold text-lg mb-2">ไม่สามารถเข้าถึงกล้องได้</h3>
          <p className="text-sm text-white/70 mb-6">{error}</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={onFile} className="hidden"/>
          <button onClick={() => fileRef.current?.click()}
            className="bg-blue-500 text-white rounded-xl px-6 py-3 font-bold flex items-center gap-2">
            <Camera size={18}/> เปิดกล้องระบบ (เลือกรูป)
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-between items-center p-4
        bg-gradient-to-b from-black/70 to-transparent">
        <button onClick={onCancel} className="text-white p-2"><X size={22}/></button>
        <div className="text-white text-sm font-bold">📷 ถ่ายภาพยืนยัน (บังคับ)</div>
        <button onClick={() => setCurrentFacing(f => f === 'user' ? 'environment' : 'user')}
          className="text-white p-2"><RotateCcw size={20}/></button>
      </div>

      {/* Camera / preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!preview ? (
          <video ref={videoRef} playsInline muted
            className="w-full h-full object-cover"/>
        ) : (
          <img src={preview} alt="captured" className="w-full h-full object-contain"/>
        )}
        <canvas ref={canvasRef} className="hidden"/>
      </div>

      {/* Footer */}
      <div className="bg-gradient-to-t from-black to-transparent p-6 pb-10">
        {!preview ? (
          <div className="flex items-center justify-center">
            <button onClick={capture}
              className="w-20 h-20 rounded-full bg-white border-4 border-white/40
                active:scale-95 transition-transform shadow-2xl"
              aria-label="capture"/>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={retake}
              className="flex-1 py-4 rounded-xl bg-white/10 text-white font-bold border border-white/20">
              ถ่ายใหม่
            </button>
            <button onClick={confirm}
              className="flex-[2] py-4 rounded-xl bg-blue-500 text-white font-bold">
              ✓ ใช้รูปนี้
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

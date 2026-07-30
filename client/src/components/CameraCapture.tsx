import { useEffect, useRef, useState } from 'react'

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function start() {
      setError(null)
      setReady(false)
      stop()
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
      } catch {
        setError('تعذّر الوصول إلى الكاميرا. تأكد من منح الإذن للتطبيق أو جرّب رفع صورة بدلاً من ذلك.')
      }
    }

    function stop() {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    start()
    return () => {
      cancelled = true
      stop()
    }
  }, [facingMode])

  function handleCapture() {
    const video = videoRef.current
    if (!video) return
    const maxDimension = 1600
    const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black aspect-[3/4]">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-300">
            {error}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-amber-300/60" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white/80">
                جاري تشغيل الكاميرا...
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
        >
          تبديل الكاميرا
        </button>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready}
          className="rounded-full bg-amber-400 px-8 py-3 font-bold text-black shadow-lg shadow-amber-400/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          التقط الصورة
        </button>
      </div>
    </div>
  )
}

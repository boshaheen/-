import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CameraCapture from '../components/CameraCapture'
import ImageUploader from '../components/ImageUploader'
import { analyzeCamelImage } from '../lib/api'
import { saveEvaluation } from '../lib/storage'
import type { EvaluationResult } from '../types'

type Mode = 'camera' | 'upload'

export default function New() {
  const [searchParams] = useSearchParams()
  const initialMode = (searchParams.get('mode') as Mode) || 'camera'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [image, setImage] = useState<string | null>(null)
  const [camelName, setCamelName] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleAnalyze() {
    if (!image) return
    setAnalyzing(true)
    setError(null)
    try {
      const analysis = await analyzeCamelImage(image, camelName || undefined)
      const result: EvaluationResult = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        imageDataUrl: image,
        camelName: camelName || undefined,
        ...analysis,
      }
      saveEvaluation(result)
      navigate(`/result/${result.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع')
      setAnalyzing(false)
    }
  }

  if (analyzing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-amber-400/30 border-t-amber-400" />
        <p className="text-lg font-bold text-white">جاري تحليل علامات الجمال...</p>
        <p className="text-sm text-white/50">قد يستغرق الأمر بضع ثوانٍ</p>
      </div>
    )
  }

  if (image) {
    return (
      <div className="flex flex-1 flex-col items-center gap-5 py-8">
        <img
          src={image}
          alt="الصورة الملتقطة"
          className="max-h-[50vh] w-full max-w-md rounded-2xl border border-white/10 object-contain"
        />

        <input
          type="text"
          value={camelName}
          onChange={(e) => setCamelName(e.target.value)}
          placeholder="اسم الناقة (اختياري)"
          className="w-full max-w-md rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
        />

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex w-full max-w-md gap-3">
          <button
            type="button"
            onClick={() => setImage(null)}
            className="flex-1 rounded-xl border border-white/20 py-3 font-bold text-white hover:bg-white/10"
          >
            إعادة الالتقاط
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            className="flex-1 rounded-xl bg-amber-400 py-3 font-bold text-black hover:bg-amber-300"
          >
            بدء التحليل
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 py-6">
      <div className="flex gap-2 rounded-full border border-white/15 p-1">
        <button
          type="button"
          onClick={() => setMode('camera')}
          className={`rounded-full px-5 py-2 text-sm font-bold transition ${
            mode === 'camera' ? 'bg-amber-400 text-black' : 'text-white/60'
          }`}
        >
          تصوير مباشر
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`rounded-full px-5 py-2 text-sm font-bold transition ${
            mode === 'upload' ? 'bg-amber-400 text-black' : 'text-white/60'
          }`}
        >
          رفع صورة
        </button>
      </div>

      {mode === 'camera' ? (
        <CameraCapture onCapture={setImage} />
      ) : (
        <ImageUploader onSelect={setImage} />
      )}
    </div>
  )
}

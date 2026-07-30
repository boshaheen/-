import { useRef, useState, type DragEvent } from 'react'
import { compressImageDataUrl, readFileAsDataUrl } from '../lib/image'

interface ImageUploaderProps {
  onSelect: (dataUrl: string) => void
}

export default function ImageUploader({ onSelect }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  async function readFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('الرجاء اختيار ملف صورة صالح (JPG أو PNG)')
      return
    }
    setError(null)
    setPreparing(true)
    try {
      const raw = await readFileAsDataUrl(file)
      const compressed = await compressImageDataUrl(raw)
      onSelect(compressed)
    } catch {
      setError('تعذّرت معالجة الصورة، جرّب صورة أخرى')
    } finally {
      setPreparing(false)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !preparing && inputRef.current?.click()}
        className={`flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragging ? 'border-amber-300 bg-amber-300/10' : 'border-white/20 bg-white/5'
        }`}
      >
        {preparing ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
            <p className="text-sm text-white/80">جارٍ تجهيز الصورة...</p>
          </>
        ) : (
          <>
            <span className="text-4xl">🐫</span>
            <p className="text-sm text-white/80">
              اضغط لاختيار صورة الناقة أو اسحبها هنا
            </p>
            <p className="text-xs text-white/40">JPG أو PNG — يفضّل صورة جانبية واضحة</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}

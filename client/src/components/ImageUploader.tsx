import { useRef, useState, type DragEvent } from 'react'

interface ImageUploaderProps {
  onSelect: (dataUrl: string) => void
}

export default function ImageUploader({ onSelect }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function readFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('الرجاء اختيار ملف صورة صالح (JPG أو PNG)')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => onSelect(reader.result as string)
    reader.readAsDataURL(file)
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
        onClick={() => inputRef.current?.click()}
        className={`flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragging ? 'border-amber-300 bg-amber-300/10' : 'border-white/20 bg-white/5'
        }`}
      >
        <span className="text-4xl">🐫</span>
        <p className="text-sm text-white/80">
          اضغط لاختيار صورة الناقة أو اسحبها هنا
        </p>
        <p className="text-xs text-white/40">JPG أو PNG — يفضّل صورة جانبية واضحة</p>
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

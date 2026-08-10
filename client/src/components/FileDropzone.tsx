import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,.docx,.xlsx,.xls,.xlsm,.csv,.zip'

interface Props {
  onFiles: (files: FileList) => void
}

export default function FileDropzone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragActive ? 'border-amber-400 bg-amber-400/10' : 'border-white/15 hover:border-white/30'
      }`}
    >
      <div className="text-4xl">📂</div>
      <p className="mt-3 text-lg font-bold">اسحب وأفلت الملفات هنا، أو اضغط للاختيار</p>
      <p className="mt-1 text-sm text-white/60">
        PDF · صور (JPG/PNG…) · Word (docx) · Excel (xlsx/csv) · أرشيف مضغوط (zip) يحتوي على أي منها
      </p>
      <p className="mt-3 text-xs text-white/40">
        🔒 كل المعالجة تتم داخل متصفحك — ملفاتك لا تُرفع لأي خادم.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

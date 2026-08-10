import type { IndexedFile } from '../types'
import { formatBytes, kindIcon } from '../lib/detect'

const STATUS_LABEL: Record<IndexedFile['status'], string> = {
  queued: 'بالانتظار…',
  processing: 'جارٍ الاستخراج…',
  done: 'جاهز',
  error: 'فشل',
  unsupported: 'صيغة غير مدعومة',
}

const STATUS_CLASS: Record<IndexedFile['status'], string> = {
  queued: 'text-white/40',
  processing: 'text-amber-300',
  done: 'text-emerald-400',
  error: 'text-red-400',
  unsupported: 'text-white/30',
}

interface Props {
  file: IndexedFile
  onRemove: (id: string) => void
}

export default function FileRow({ file, onRemove }: Props) {
  const matchCount = file.units.length

  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="text-xl" aria-hidden>
        {file.status === 'unsupported' ? '❓' : kindIcon(file.kind)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" dir="auto" title={file.name}>
          {file.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-white/40">{formatBytes(file.sizeBytes)}</span>
          <span className={STATUS_CLASS[file.status]}>{STATUS_LABEL[file.status]}</span>
          {file.status === 'done' && matchCount > 0 && (
            <span className="text-white/40">· {matchCount} {file.kind === 'xlsx' ? 'ورقة/جدول' : file.kind === 'pdf' ? 'صفحة' : 'قسم'}</span>
          )}
          {file.note && <span className="text-white/40">· {file.note}</span>}
        </div>
        {file.status === 'processing' && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${Math.max(5, file.progress)}%` }}
            />
          </div>
        )}
        {file.status === 'error' && file.error && (
          <p className="mt-0.5 text-xs text-red-400" dir="auto">
            {file.error}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(file.id)}
        aria-label="إزالة الملف"
        className="shrink-0 rounded-full p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </li>
  )
}

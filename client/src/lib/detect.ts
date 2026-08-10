import type { SupportedKind } from '../types'

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif']
const SPREADSHEET_EXTS = ['xlsx', 'xls', 'xlsm', 'csv']

export function extOf(name: string): string {
  const dot = name.toLowerCase().lastIndexOf('.')
  return dot === -1 ? '' : name.toLowerCase().slice(dot + 1)
}

/** Returns the kind we know how to extract text from, or null if unsupported. */
export function detectKind(name: string): SupportedKind | null {
  const ext = extOf(name)
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_EXTS.includes(ext)) return 'image'
  if (ext === 'docx') return 'docx'
  if (SPREADSHEET_EXTS.includes(ext)) return 'xlsx'
  if (ext === 'zip') return 'zip'
  return null
}

export function kindLabel(kind: SupportedKind | null): string {
  switch (kind) {
    case 'pdf':
      return 'PDF'
    case 'image':
      return 'صورة'
    case 'docx':
      return 'Word'
    case 'xlsx':
      return 'Excel'
    case 'zip':
      return 'مضغوط'
    default:
      return 'غير مدعوم'
  }
}

export function kindIcon(kind: SupportedKind | null): string {
  switch (kind) {
    case 'pdf':
      return '📄'
    case 'image':
      return '🖼️'
    case 'docx':
      return '📝'
    case 'xlsx':
      return '📊'
    case 'zip':
      return '🗜️'
    default:
      return '❓'
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`
  const units = ['كيلوبايت', 'ميغابايت', 'غيغابايت']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(1)} ${units[i]}`
}

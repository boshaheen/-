export type SupportedKind = 'pdf' | 'image' | 'docx' | 'xlsx' | 'zip'

export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'unsupported'

/** One searchable unit of text extracted from a file (a PDF page, an Excel sheet, a whole doc…). */
export interface TextUnit {
  /** Human label shown next to matches, e.g. "صفحة 3" or "ورقة Sheet1". */
  label: string
  text: string
}

export interface IndexedFile {
  id: string
  /** Display path — includes the zip entry path when the file came from an archive. */
  name: string
  /** Original File object, kept only for non-archive files (used to preview/download later if needed). */
  kind: SupportedKind
  sizeBytes: number
  status: FileStatus
  progress: number // 0..100
  error?: string
  /** Short informational note, e.g. "تم استخراج 5 ملفات من الأرشيف". */
  note?: string
  units: TextUnit[]
}

export interface SearchMatch {
  fileId: string
  fileName: string
  unitLabel: string
  /** Character offset of the match inside the unit's original text. */
  start: number
  end: number
  /** Snippet of surrounding text, with matchStart/matchEnd relative to the snippet. */
  snippet: string
  matchStart: number
  matchEnd: number
}

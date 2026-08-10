export type SupportedKind = 'pdf' | 'image' | 'docx' | 'xlsx' | 'zip'

export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'unsupported'

/**
 * The bounding box of one word/glyph-run within a TextUnit's `text`, in the source's own
 * coordinate space — PDF "user space" points for pdf units, pixel space of the original bitmap
 * for image (OCR) units. Lets the "View" feature draw a highlight over the real page/image
 * instead of just showing a text snippet.
 */
export interface Span {
  start: number
  end: number
  x0: number
  y0: number
  x1: number
  y1: number
  /** Reading direction of the source run — 'rtl' spans map their first character to x1, not x0. */
  dir?: string
}

/** One searchable unit of text extracted from a file (a PDF page, an Excel sheet, a whole doc…). */
export interface TextUnit {
  /** Human label shown next to matches, e.g. "صفحة 3" or "ورقة Sheet1". */
  label: string
  text: string
  /** 1-based page number — set for PDF units only. */
  pageIndex?: number
  /** Word/glyph bounding boxes, in source coordinate space — set for PDF and image (OCR) units. */
  spans?: Span[]
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
  fileKind: SupportedKind
  unitLabel: string
  /** 1-based PDF page number, when the match came from a PDF unit. */
  pageIndex?: number
  /** Word bounding boxes for the unit this match came from (see TextUnit.spans). */
  spans?: Span[]
  /** Character offset of the match inside the unit's original text. */
  start: number
  end: number
  /** Snippet of surrounding text, with matchStart/matchEnd relative to the snippet. */
  snippet: string
  matchStart: number
  matchEnd: number
}

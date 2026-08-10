import { useEffect, useRef, useState } from 'react'
import type { Span, SupportedKind } from '../types'
import { renderPdfPage } from '../lib/extract'

interface Props {
  fileKind: SupportedKind
  fileName: string
  blob: Blob
  pageIndex?: number
  spans?: Span[]
  matchStart: number
  matchEnd: number
  onClose: () => void
}

const PDF_SCALE = 1.8

export default function PageViewer({ fileKind, fileName, blob, pageIndex, spans, matchStart, matchEnd, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d10]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold" dir="auto" title={fileName}>
            {fileName}
            {pageIndex ? ` — صفحة ${pageIndex}` : ''}
          </p>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="shrink-0 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="overflow-auto p-3">
          {fileKind === 'pdf' && pageIndex ? (
            <PdfPage blob={blob} pageIndex={pageIndex} spans={spans} matchStart={matchStart} matchEnd={matchEnd} />
          ) : (
            <ImagePage blob={blob} spans={spans} matchStart={matchStart} matchEnd={matchEnd} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * A PDF Span covers a whole pdf.js text run (often a full line/sentence, not just one word), so
 * highlighting the entire span would light up far more than the matched phrase. Narrow each
 * overlapping span down to just the matched character range, interpolating linearly across its
 * width — an approximation (real glyphs aren't equal-width), but close enough for a highlight box.
 * 'rtl' spans read right-to-left, so their first character sits at x1, not x0.
 */
function overlappingRects(
  spans: Span[] | undefined,
  matchStart: number,
  matchEnd: number,
): Array<{ x0: number; y0: number; x1: number; y1: number }> {
  const out: Array<{ x0: number; y0: number; x1: number; y1: number }> = []
  for (const s of spans ?? []) {
    if (s.start >= matchEnd || s.end <= matchStart) continue
    const len = s.end - s.start || 1
    const fromFrac = Math.max(0, matchStart - s.start) / len
    const toFrac = Math.min(len, matchEnd - s.start) / len
    const at = (frac: number) => (s.dir === 'rtl' ? s.x1 - frac * (s.x1 - s.x0) : s.x0 + frac * (s.x1 - s.x0))
    const a = at(fromFrac)
    const b = at(toFrac)
    out.push({ x0: Math.min(a, b), x1: Math.max(a, b), y0: s.y0, y1: s.y1 })
  }
  return out
}

function PdfPage({
  blob,
  pageIndex,
  spans,
  matchStart,
  matchEnd,
}: {
  blob: Blob
  pageIndex: number
  spans?: Span[]
  matchStart: number
  matchEnd: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return
        const { convertRect } = await renderPdfPage(blob, pageIndex, canvas, PDF_SCALE)
        if (cancelled) return
        const ctx = canvas.getContext('2d')!
        for (const span of overlappingRects(spans, matchStart, matchEnd)) {
          const [rx0, ry0, rx1, ry1] = convertRect([span.x0, span.y0, span.x1, span.y1])
          const x = Math.min(rx0, rx1)
          const y = Math.min(ry0, ry1)
          const w = Math.abs(rx1 - rx0)
          const h = Math.abs(ry1 - ry0)
          const pad = h * 0.15
          ctx.fillStyle = 'rgba(251,191,36,0.45)'
          ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2)
          ctx.strokeStyle = 'rgba(217,119,6,0.9)'
          ctx.lineWidth = 2
          ctx.strokeRect(x - pad, y - pad, w + pad * 2, h + pad * 2)
        }
        setState('done')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blob, pageIndex, spans, matchStart, matchEnd])

  return (
    <div className="relative">
      {state === 'loading' && <p className="py-10 text-center text-sm text-white/50">جارٍ تحميل الصفحة…</p>}
      {state === 'error' && <p className="py-10 text-center text-sm text-red-400">تعذّر عرض الصفحة.</p>}
      <canvas ref={canvasRef} className={`mx-auto max-w-full rounded-lg ${state === 'done' ? '' : 'hidden'}`} />
      {!spans?.length && state === 'done' && (
        <p className="mt-2 text-center text-xs text-white/40">تعذّر تحديد موضع العبارة بدقة على الصفحة — إليك الصفحة كاملة.</p>
      )}
    </div>
  )
}

function ImagePage({
  blob,
  spans,
  matchStart,
  matchEnd,
}: {
  blob: Blob
  spans?: Span[]
  matchStart: number
  matchEnd: number
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  const rects = overlappingRects(spans, matchStart, matchEnd)

  return (
    <div className="relative mx-auto inline-block max-w-full">
      {url && (
        <img
          src={url}
          alt=""
          className="mx-auto max-h-[75vh] max-w-full rounded-lg"
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      )}
      {natural &&
        rects.map((span, i) => (
          <div
            key={i}
            className="pointer-events-none absolute rounded-sm border-2 border-amber-600/90 bg-amber-400/40"
            style={{
              left: `${(span.x0 / natural.w) * 100}%`,
              top: `${(span.y0 / natural.h) * 100}%`,
              width: `${((span.x1 - span.x0) / natural.w) * 100}%`,
              height: `${((span.y1 - span.y0) / natural.h) * 100}%`,
            }}
          />
        ))}
      {natural && rects.length === 0 && (
        <p className="mt-2 text-center text-xs text-white/40">تعذّر تحديد موضع العبارة بدقة على الصورة — إليك الصورة كاملة.</p>
      )}
    </div>
  )
}

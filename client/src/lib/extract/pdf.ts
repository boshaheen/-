import * as pdfjsLib from 'pdfjs-dist'
// Vite: resolve the worker script to a hashed URL at build time.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
import type { Span, TextUnit } from '../../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export async function extractPdf(blob: Blob, onProgress?: (percent: number) => void): Promise<TextUnit[]> {
  const buffer = await blob.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const units: TextUnit[] = []
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const { text, spans } = joinTextItems(content.items)
      units.push({ label: `صفحة ${pageNum}`, text, pageIndex: pageNum, spans })
      onProgress?.(Math.round((pageNum / doc.numPages) * 100))
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return units
}

/** Re-opens a previously-extracted PDF (from its original blob) and renders one page to a canvas. */
export async function renderPdfPage(
  blob: Blob,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<{ width: number; height: number; convertRect: (r: [number, number, number, number]) => [number, number, number, number] }> {
  const buffer = await blob.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  try {
    const page = await doc.getPage(pageIndex)
    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    return {
      width: viewport.width,
      height: viewport.height,
      convertRect: (r) => viewport.convertToViewportRectangle(r) as [number, number, number, number],
    }
  } finally {
    await doc.destroy()
  }
}

/**
 * pdf.js hands back one TextItem per run of glyphs it could confidently combine — for some fonts
 * (notably several Arabic ones, where each letter's connective shaping changes its advance width)
 * that can mean one item per *letter*. Blindly joining every item with `.join(' ')` then breaks
 * every word apart, and for Arabic it also stops the browser from shaping the letters into their
 * joined cursive form (a space always forces isolated letterforms). So: trust each item's own text
 * for real spaces (pdf.js already includes them when the PDF has an actual space glyph), only add
 * a line break on an actual line change, and otherwise decide on a space by comparing the gap to
 * the *actual glyph width* of the surrounding text (not font height — advance width and cap-height
 * aren't the same axis, and using width is far more reliable across fonts).
 *
 * Also records each item's PDF-space bounding box (as a Span over the char range it contributed),
 * so a later "view" step can highlight exactly where a match sits on the rendered page.
 */
function joinTextItems(items: Array<TextItem | TextMarkedContent>): { text: string; spans: Span[] } {
  let text = ''
  let prev: TextItem | null = null
  const spans: Span[] = []
  for (const raw of items) {
    if (!('str' in raw)) continue
    if (prev) {
      const prevScale = Math.abs(prev.transform[3]) || Math.abs(prev.height) || 10
      const sameLine = Math.abs(raw.transform[5] - prev.transform[5]) < prevScale * 0.5
      if (!sameLine) {
        text += '\n'
      } else {
        const prevEnd = prev.dir === 'rtl' ? prev.transform[4] - prev.width : prev.transform[4] + prev.width
        const gap = prev.dir === 'rtl' ? prevEnd - raw.transform[4] : raw.transform[4] - prevEnd
        // "How wide is one ordinary character here" — derived from each item's own advance width
        // divided by its length, which is exactly the axis we're measuring the gap on.
        const prevCharWidth = prev.str.length ? Math.abs(prev.width) / prev.str.length : 0
        const rawCharWidth = raw.str.length ? Math.abs(raw.width) / raw.str.length : 0
        const refWidth = Math.max(prevCharWidth, rawCharWidth, prevScale * 0.3)
        const alreadySpaced = /\s$/.test(prev.str) || /^\s/.test(raw.str)
        if (!alreadySpaced && gap > refWidth * 0.4) text += ' '
      }
    }
    const start = text.length
    text += raw.str
    if (raw.str.trim()) {
      const x0 = raw.dir === 'rtl' ? raw.transform[4] - raw.width : raw.transform[4]
      const x1 = raw.dir === 'rtl' ? raw.transform[4] : raw.transform[4] + raw.width
      const y0 = raw.transform[5]
      const y1 = raw.transform[5] + (raw.height || Math.abs(raw.transform[3]) || 10)
      spans.push({ start, end: start + raw.str.length, x0, y0, x1, y1, dir: raw.dir })
    }
    if (raw.hasEOL) text += '\n'
    prev = raw
  }
  return { text, spans }
}

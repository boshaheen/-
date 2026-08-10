import * as pdfjsLib from 'pdfjs-dist'
// Vite: resolve the worker script to a hashed URL at build time.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'
import type { TextUnit } from '../../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export async function extractPdf(blob: Blob, onProgress?: (percent: number) => void): Promise<TextUnit[]> {
  const buffer = await blob.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise
  const units: TextUnit[] = []
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const text = joinTextItems(content.items)
      units.push({ label: `صفحة ${pageNum}`, text })
      onProgress?.(Math.round((pageNum / doc.numPages) * 100))
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return units
}

/**
 * pdf.js hands back one TextItem per run of glyphs it could confidently combine — for some fonts
 * (notably several Arabic ones, where each letter's connective shaping changes its advance width)
 * that can mean one item per *letter*. Blindly joining every item with `.join(' ')` then breaks
 * every word apart, and for Arabic it also stops the browser from shaping the letters into their
 * joined cursive form (a space always forces isolated letterforms). So: trust each item's own text
 * for real spaces (pdf.js already includes them when the PDF has an actual space glyph), only add
 * a line break on an actual line change, and only synthesize a space for a genuinely large
 * horizontal jump — small letter-to-letter gaps (even fairly wide ones, for fonts with big advance
 * widths) are left alone rather than risk shredding words the way the naive join did.
 */
function joinTextItems(items: Array<TextItem | TextMarkedContent>): string {
  let text = ''
  let prev: TextItem | null = null
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
        const scale = Math.max(Math.abs(prev.height) || 0, Math.abs(raw.height) || 0, prevScale, 1)
        const alreadySpaced = /\s$/.test(prev.str) || /^\s/.test(raw.str)
        if (!alreadySpaced && gap > scale * 1.1) text += ' '
      }
    }
    text += raw.str
    if (raw.hasEOL) text += '\n'
    prev = raw
  }
  return text
}

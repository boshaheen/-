import * as pdfjsLib from 'pdfjs-dist'
// Vite: resolve the worker script to a hashed URL at build time.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
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
      const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
      units.push({ label: `صفحة ${pageNum}`, text })
      onProgress?.(Math.round((pageNum / doc.numPages) * 100))
      page.cleanup()
    }
  } finally {
    await doc.destroy()
  }
  return units
}

import { createWorker, type Worker, type Page as OcrPage } from 'tesseract.js'
import type { Span, TextUnit } from '../../types'

// A single OCR worker (Arabic + English) is created lazily and reused across every image,
// since spinning one up per file is slow and each carries its own downloaded language data.
// The first use downloads the OCR engine + language data from a CDN (cached by the browser
// afterwards) — a timeout keeps a flaky connection from hanging the UI forever.
let workerPromise: Promise<Worker> | null = null
let currentProgressCb: ((percent: number) => void) | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = withTimeout(
      createWorker('ara+eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text') currentProgressCb?.(Math.round(m.progress * 100))
        },
      }),
      60_000,
      'تعذّر تحميل محرك التعرف الضوئي على الحروف (OCR) — تحقّق من اتصالك بالإنترنت وحاول مجددًا.',
    ).catch((err) => {
      workerPromise = null // allow retrying on the next image instead of caching the failure
      throw err
    })
  }
  return workerPromise
}

/** Rebuilds text from tesseract's line/word structure (rather than the flat `data.text`) so each
 * word keeps its bounding box — that's what lets the "view" feature point at the exact word on
 * the source image. Words within a line are joined with a single space, lines with a newline. */
function buildTextWithSpans(data: OcrPage): { text: string; spans: Span[] } {
  const lines = data.lines ?? []
  if (!lines.length) return { text: data.text, spans: [] }

  let text = ''
  const spans: Span[] = []
  for (const line of lines) {
    for (const word of line.words) {
      if (!word.text.trim()) continue
      if (text.length && !text.endsWith('\n')) text += ' '
      const start = text.length
      text += word.text
      spans.push({ start, end: start + word.text.length, x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 })
    }
    text += '\n'
  }
  return { text: text.trimEnd(), spans }
}

async function recognize(input: Blob | HTMLCanvasElement, onProgress?: (percent: number) => void) {
  const worker = await getWorker()
  currentProgressCb = onProgress ?? null
  try {
    const { data } = await withTimeout(worker.recognize(input), 90_000, 'استغرق التعرف الضوئي على النص وقتًا طويلاً جدًا.')
    onProgress?.(100)
    return buildTextWithSpans(data)
  } finally {
    currentProgressCb = null
  }
}

export async function extractImage(blob: Blob, onProgress?: (percent: number) => void): Promise<TextUnit[]> {
  const { text, spans } = await recognize(blob, onProgress)
  return [{ label: 'نص الصورة (OCR)', text, spans }]
}

/** Runs OCR directly on an already-rendered canvas (used for scanned/image-only PDF pages). */
export async function recognizeCanvas(canvas: HTMLCanvasElement, onProgress?: (percent: number) => void) {
  return recognize(canvas, onProgress)
}

/** Frees the OCR worker. Call once no more images are queued (or on unmount). */
export async function terminateImageWorker() {
  if (!workerPromise) return
  const promise = workerPromise
  workerPromise = null
  try {
    const worker = await promise
    await worker.terminate()
  } catch {
    // worker never finished initializing — nothing to terminate
  }
}

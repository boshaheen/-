import { createWorker, type Worker } from 'tesseract.js'
import type { TextUnit } from '../../types'

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

export async function extractImage(blob: Blob, onProgress?: (percent: number) => void): Promise<TextUnit[]> {
  const worker = await getWorker()
  currentProgressCb = onProgress ?? null
  try {
    const {
      data: { text },
    } = await withTimeout(worker.recognize(blob), 90_000, 'استغرق التعرف الضوئي على النص وقتًا طويلاً جدًا.')
    onProgress?.(100)
    return [{ label: 'نص الصورة (OCR)', text }]
  } finally {
    currentProgressCb = null
  }
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

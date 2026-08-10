import type { SupportedKind, TextUnit } from '../../types'

// Tracks whether the (heavy) OCR module was ever loaded, so terminateImageWorker() below can
// no-op instead of pulling in tesseract.js just to shut down a worker that never existed.
let ocrLoaded = false

/**
 * Each format's parser (pdfjs, mammoth, xlsx, tesseract.js) is a sizeable library, so they're
 * loaded on demand — a user who only ever searches PDFs never downloads the OCR engine.
 */
export async function extractUnits(
  kind: Exclude<SupportedKind, 'zip'>,
  blob: Blob,
  fileName: string,
  onProgress?: (percent: number) => void,
): Promise<TextUnit[]> {
  switch (kind) {
    case 'pdf': {
      const { extractPdf } = await import('./pdf')
      return extractPdf(blob, onProgress)
    }
    case 'docx': {
      const { extractDocx } = await import('./docx')
      return extractDocx(blob)
    }
    case 'xlsx': {
      const { extractSpreadsheet } = await import('./spreadsheet')
      return extractSpreadsheet(blob, fileName)
    }
    case 'image': {
      ocrLoaded = true
      const { extractImage } = await import('./image')
      return extractImage(blob, onProgress)
    }
  }
}

export async function listZipEntries(blob: Blob, basePath: string) {
  const { listZipEntries: run } = await import('./zip')
  return run(blob, basePath)
}

export async function terminateImageWorker() {
  if (!ocrLoaded) return
  const { terminateImageWorker: run } = await import('./image')
  return run()
}

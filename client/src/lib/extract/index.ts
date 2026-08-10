import type { SupportedKind, TextUnit } from '../../types'

/**
 * Each format's parser (pdfjs, mammoth, xlsx, tesseract.js) is a sizeable library, so they're
 * loaded on demand — a user who only ever searches PDFs never downloads the OCR engine (unless a
 * PDF page turns out to be a scan with no text layer, in which case pdf.ts pulls in ./image
 * itself to OCR that page).
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
      const { extractImage } = await import('./image')
      return extractImage(blob, onProgress)
    }
  }
}

/** Re-renders one PDF page to a canvas, for the "view" feature. Loaded on demand like the rest. */
export async function renderPdfPage(blob: Blob, pageIndex: number, canvas: HTMLCanvasElement, scale: number) {
  const { renderPdfPage: run } = await import('./pdf')
  return run(blob, pageIndex, canvas, scale)
}

export async function listZipEntries(blob: Blob, basePath: string) {
  const { listZipEntries: run } = await import('./zip')
  return run(blob, basePath)
}

export async function terminateImageWorker() {
  const { terminateImageWorker: run } = await import('./image')
  return run()
}

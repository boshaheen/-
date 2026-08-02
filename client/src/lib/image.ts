const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.9

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('تعذّرت قراءة الصورة'))
    img.src = src
  })
}

/**
 * Downscales an image data URL so the resulting base64 payload stays
 * comfortably under serverless request body limits (e.g. Vercel's 4.5MB).
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = MAX_DIMENSION,
  quality = JPEG_QUALITY,
): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
  const width = Math.round(img.width * scale)
  const height = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'))
    reader.readAsDataURL(file)
  })
}

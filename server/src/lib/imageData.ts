const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/

export function parseImageDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) {
    throw new Error('صيغة الصورة غير مدعومة، الرجاء استخدام JPG أو PNG أو WEBP')
  }
  const [, mediaType, base64] = match
  return { mediaType, base64 }
}

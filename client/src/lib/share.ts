export function buildWhatsAppText(params: {
  camelName?: string
  overallScore: number
  grade: string
}): string {
  const name = params.camelName ? `الناقة "${params.camelName}"` : 'الناقة'
  return `تقييم علامات الجمال لـ ${name}\nالنتيجة الإجمالية: ${params.overallScore}/100\nالمستوى: ${params.grade}\n\nتم التقييم بواسطة مُقيّم الإبل الذكي`
}

export function openWhatsAppShare(text: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

export async function shareFile(file: File, text: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>
  }

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    await nav.share({ files: [file], text, title: 'تقرير تقييم الإبل' })
    return true
  }
  return false
}

export function base64ToFile(base64: string, fileName: string): File {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new File([byteArray], fileName, { type: 'application/pdf' })
}

import type { TraitScore, Grade } from '../types'

export interface AnalyzeResponse {
  overallScore: number
  grade: Grade
  summary: string
  traits: TraitScore[]
  recommendations: string[]
}

export async function analyzeCamelImage(
  imageDataUrl: string,
  camelName?: string,
): Promise<AnalyzeResponse> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, camelName }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || 'تعذّر تحليل الصورة، حاول مرة أخرى')
  }

  return res.json()
}

export async function emailReport(params: {
  to: string
  camelName?: string
  overallScore: number
  grade: string
  pdfBase64: string
  fileName: string
}): Promise<void> {
  const res = await fetch('/api/report/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || 'تعذّر إرسال البريد الإلكتروني')
  }
}

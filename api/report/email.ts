import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendReportEmail } from '../../server/src/lib/email.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return
  }

  const { to, camelName, overallScore, grade, pdfBase64, fileName } = req.body ?? {}

  if (typeof to !== 'string' || !EMAIL_RE.test(to)) {
    res.status(400).json({ error: 'بريد إلكتروني غير صالح' })
    return
  }
  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    res.status(400).json({ error: 'ملف التقرير مفقود' })
    return
  }

  try {
    await sendReportEmail({
      to,
      camelName: typeof camelName === 'string' ? camelName : undefined,
      overallScore: Number(overallScore) || 0,
      grade: typeof grade === 'string' ? grade : '',
      pdfBase64,
      fileName: typeof fileName === 'string' ? fileName : 'تقرير-تقييم.pdf',
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('email error', err)
    res.status(502).json({
      error: err instanceof Error ? err.message : 'تعذّر إرسال البريد',
    })
  }
}

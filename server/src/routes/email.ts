import { Router } from 'express'
import { sendReportEmail } from '../lib/email.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/', async (req, res) => {
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
    res.json({ ok: true })
  } catch (err) {
    console.error('email error', err)
    res.status(502).json({
      error: err instanceof Error ? err.message : 'تعذّر إرسال البريد',
    })
  }
})

export default router

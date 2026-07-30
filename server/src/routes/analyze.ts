import { Router } from 'express'
import { analyzeCamelPhoto } from '../lib/anthropic.js'

const router = Router()

router.post('/', async (req, res) => {
  const { imageDataUrl, camelName } = req.body ?? {}

  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    res.status(400).json({ error: 'صورة غير صالحة' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'مفتاح ANTHROPIC_API_KEY غير مُعدّ على الخادم' })
    return
  }

  try {
    const result = await analyzeCamelPhoto(
      imageDataUrl,
      typeof camelName === 'string' ? camelName : undefined,
    )
    res.json(result)
  } catch (err) {
    console.error('analyze error', err)
    res.status(502).json({
      error: err instanceof Error ? err.message : 'تعذّر تحليل الصورة',
    })
  }
})

export default router

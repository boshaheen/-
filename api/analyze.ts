import type { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeCamelPhoto } from '../server/src/lib/anthropic.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'الطريقة غير مسموحة' })
    return
  }

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
    res.status(200).json(result)
  } catch (err) {
    console.error('analyze error', err)
    res.status(502).json({
      error: err instanceof Error ? err.message : 'تعذّر تحليل الصورة',
    })
  }
}

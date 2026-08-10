import mammoth from 'mammoth'
import type { TextUnit } from '../../types'

export async function extractDocx(blob: Blob): Promise<TextUnit[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return [{ label: 'المستند', text: result.value }]
}

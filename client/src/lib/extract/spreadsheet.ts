import * as XLSX from 'xlsx'
import type { TextUnit } from '../../types'
import { extOf } from '../detect'

export async function extractSpreadsheet(blob: Blob, fileName: string): Promise<TextUnit[]> {
  const isCsv = extOf(fileName) === 'csv'
  const workbook = isCsv
    ? XLSX.read(await blob.text(), { type: 'string' })
    : XLSX.read(await blob.arrayBuffer(), { type: 'array' })

  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const text = XLSX.utils.sheet_to_csv(sheet, { FS: '  |  ', blankrows: false })
    return { label: isCsv ? 'الجدول' : `ورقة "${name}"`, text }
  })
}

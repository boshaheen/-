import JSZip from 'jszip'
import { detectKind } from '../detect'

export interface ZipEntry {
  /** Path shown to the user, including the archive name and any nested folders. */
  path: string
  blob: Blob
  kind: Exclude<ReturnType<typeof detectKind>, 'zip' | null>
}

const MAX_ENTRIES = 300

function isJunk(path: string): boolean {
  const base = path.split('/').pop() ?? ''
  return path.startsWith('__MACOSX/') || base.startsWith('.') || base === ''
}

/** Recursively walks a .zip (including nested .zip files inside it) and returns every supported file. */
export async function listZipEntries(blob: Blob, basePath: string): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(blob)
  const out: ZipEntry[] = []

  for (const entry of Object.values(zip.files)) {
    if (out.length >= MAX_ENTRIES) break
    if (entry.dir || isJunk(entry.name)) continue

    const fullPath = `${basePath}/${entry.name}`
    const kind = detectKind(entry.name)
    if (!kind) continue

    const entryBlob = await entry.async('blob')
    if (kind === 'zip') {
      const nested = await listZipEntries(entryBlob, fullPath)
      out.push(...nested.slice(0, MAX_ENTRIES - out.length))
    } else {
      out.push({ path: fullPath, blob: entryBlob, kind })
    }
  }

  return out
}

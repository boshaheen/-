import { useEffect, useMemo, useRef, useState } from 'react'
import type { IndexedFile, SearchMatch } from './types'
import { detectKind } from './lib/detect'
import { extractUnits, listZipEntries, terminateImageWorker } from './lib/extract'
import { findMatches, buildSnippet } from './lib/search'
import { copyText } from './lib/clipboard'
import FileDropzone from './components/FileDropzone'
import FileRow from './components/FileRow'
import SearchBar from './components/SearchBar'
import ResultsList, { type FileGroup } from './components/ResultsList'

function newId() {
  return crypto.randomUUID()
}

export default function App() {
  const [files, setFiles] = useState<IndexedFile[]>([])
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const blobsRef = useRef(new Map<string, Blob>())
  const processingRef = useRef(false)

  // Debounce the search box so we don't re-scan every file on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(t)
  }, [query])

  function updateFile(id: string, patch: Partial<IndexedFile>) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function addBlob(name: string, blob: Blob): IndexedFile {
    const id = newId()
    const kind = detectKind(name)
    blobsRef.current.set(id, blob)
    return {
      id,
      name,
      kind: kind ?? 'pdf',
      sizeBytes: blob.size,
      status: kind ? 'queued' : 'unsupported',
      progress: 0,
      units: [],
    }
  }

  function handleFiles(list: FileList) {
    const entries = Array.from(list).map((f) => addBlob(f.name, f))
    setFiles((prev) => [...prev, ...entries])
  }

  function removeFile(id: string) {
    blobsRef.current.delete(id)
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  function clearAll() {
    blobsRef.current.clear()
    setFiles([])
    setQuery('')
    void terminateImageWorker()
  }

  // Sequential background processor: picks the next queued file, extracts its text, repeats.
  useEffect(() => {
    if (processingRef.current) return
    const next = files.find((f) => f.status === 'queued')
    if (!next) return
    const current = next

    processingRef.current = true
    const blob = blobsRef.current.get(current.id)

    async function run() {
      if (!blob) {
        updateFile(current.id, { status: 'error', error: 'تعذّر قراءة الملف' })
        return
      }
      updateFile(current.id, { status: 'processing', progress: 0 })
      try {
        if (current.kind === 'zip') {
          const entries = await listZipEntries(blob, current.name)
          const newFiles = entries.map((entry) => {
            const id = newId()
            blobsRef.current.set(id, entry.blob)
            return {
              id,
              name: entry.path,
              kind: entry.kind,
              sizeBytes: entry.blob.size,
              status: 'queued' as const,
              progress: 0,
              units: [],
            }
          })
          setFiles((prev) => [
            ...prev.map((f) =>
              f.id === current.id
                ? {
                    ...f,
                    status: 'done' as const,
                    progress: 100,
                    note: entries.length ? `تم استخراج ${entries.length} ملف مدعوم` : 'لا يحتوي على ملفات مدعومة',
                  }
                : f,
            ),
            ...newFiles,
          ])
        } else {
          const units = await extractUnits(current.kind, blob, current.name, (p) => updateFile(current.id, { progress: p }))
          updateFile(current.id, { status: 'done', progress: 100, units })
        }
      } catch (err) {
        updateFile(current.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'فشل استخراج محتوى الملف',
        })
      } finally {
        processingRef.current = false
      }
    }

    void run()
    // Re-run whenever the file list changes so the next queued item gets picked up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files])

  useEffect(() => () => void terminateImageWorker(), [])

  const groups: FileGroup[] = useMemo(() => {
    const q = debouncedQuery.trim()
    if (!q) return []
    const out: FileGroup[] = []
    for (const file of files) {
      if (file.status !== 'done') continue
      const matches: SearchMatch[] = []
      for (const unit of file.units) {
        for (const raw of findMatches(unit.text, q)) {
          const snippet = buildSnippet(unit.text, raw.start, raw.end)
          matches.push({
            fileId: file.id,
            fileName: file.name,
            unitLabel: unit.label,
            start: raw.start,
            end: raw.end,
            snippet: snippet.text,
            matchStart: snippet.matchStart,
            matchEnd: snippet.matchEnd,
          })
        }
      }
      if (matches.length) out.push({ file, matches })
    }
    return out
  }, [files, debouncedQuery])

  const totalMatches = groups.reduce((sum, g) => sum + g.matches.length, 0)
  const readyCount = files.filter((f) => f.status === 'done' || f.status === 'error' || f.status === 'unsupported').length

  async function copyAll() {
    const text = groups
      .map((g) => `📄 ${g.file.name} (${g.matches.length} نتيجة)\n${g.matches.map((m) => `  • [${m.unitLabel}] ${m.snippet}`).join('\n')}`)
      .join('\n\n')
    await copyText(text)
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-16">
      <header className="pt-8 pb-4 text-center">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">🔍 محرك بحث داخل الملفات</h1>
        <p className="mt-2 text-sm text-white/60">
          ارفع PDF أو صورة أو Word أو Excel أو أرشيف مضغوط، وابحث عن أي عبارة داخل محتواها — مع نسخ النتيجة بضغطة زر.
        </p>
      </header>

      <FileDropzone onFiles={handleFiles} />

      {files.length > 0 && (
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white/70">الملفات ({files.length})</h2>
            <button onClick={clearAll} className="text-xs text-white/40 hover:text-white/70">
              مسح الكل
            </button>
          </div>
          <ul className="space-y-2">
            {files.map((f) => (
              <FileRow key={f.id} file={f} onRemove={removeFile} />
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <SearchBar
          value={query}
          onChange={setQuery}
          matchCount={totalMatches}
          fileCount={files.length}
          readyCount={readyCount}
        />

        {debouncedQuery.trim() && totalMatches > 0 && (
          <div className="mb-3 flex justify-end">
            <button
              onClick={copyAll}
              className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/20"
            >
              نسخ كل النتائج
            </button>
          </div>
        )}

        <ResultsList groups={groups} query={debouncedQuery} />
      </div>

      <footer className="mt-10 text-center text-xs text-white/30">
        يعمل بالكامل من داخل متصفحك (JavaScript + WebAssembly) — لا يتم رفع أي ملف إلى أي خادم.
      </footer>
    </div>
  )
}

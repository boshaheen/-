import { useState } from 'react'
import type { IndexedFile, SearchMatch } from '../types'
import { kindIcon } from '../lib/detect'
import { copyText } from '../lib/clipboard'
import Highlight from './Highlight'

export interface FileGroup {
  file: IndexedFile
  matches: SearchMatch[]
}

function formatGroup(group: FileGroup): string {
  const lines = group.matches.map((m) => `  • [${m.unitLabel}] ${m.snippet}`)
  return `📄 ${group.file.name} (${group.matches.length} نتيجة)\n${lines.join('\n')}`
}

function CopyButton({ getText, label = 'نسخ' }: { getText: () => string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        const ok = await copyText(getText())
        if (ok) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 hover:border-white/30 hover:text-white"
    >
      {copied ? '✓ تم النسخ' : label}
    </button>
  )
}

interface Props {
  groups: FileGroup[]
  query: string
  onView: (match: SearchMatch) => void
}

/** "View" only makes sense where we can show a real page/image: PDF pages and OCR'd images. */
function canView(match: SearchMatch): boolean {
  if (match.fileKind === 'pdf') return !!match.pageIndex
  return match.fileKind === 'image'
}

export default function ResultsList({ groups, query, onView }: Props) {
  if (!query.trim()) return null

  const total = groups.reduce((sum, g) => sum + g.matches.length, 0)

  if (total === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-white/50">
        لا توجد نتائج لِـ «{query}»
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <details key={group.file.id} open className="rounded-xl border border-white/10 bg-white/5 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span aria-hidden>{kindIcon(group.file.kind)}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold" dir="auto">
              {group.file.name}
            </span>
            <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">
              {group.matches.length} نتيجة
            </span>
            <CopyButton getText={() => formatGroup(group)} label="نسخ نتائج الملف" />
          </summary>
          <ul className="mt-3 space-y-2">
            {group.matches.map((m, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm leading-relaxed"
              >
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-xs text-white/40">{m.unitLabel}</p>
                  <Highlight text={m.snippet} start={m.matchStart} end={m.matchEnd} />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {canView(m) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onView(m)
                      }}
                      className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/20"
                    >
                      عرض
                    </button>
                  )}
                  <CopyButton getText={() => m.snippet} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

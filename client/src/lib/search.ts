/**
 * Arabic/Latin-aware substring search.
 *
 * Strips Arabic diacritics/tatweel and folds common letter variants (أ/إ/آ → ا, ة → ه, ى → ي…)
 * plus Latin case, so a search for "الشركة" also finds "الشَّرِكَة" or "الشركه", and "Invoice"
 * finds "INVOICE". A position map lets us translate a match found in the normalized text back
 * to the exact offsets in the original text, so highlighting and snippets stay accurate.
 */

const DIACRITIC_RANGES: Array<[number, number]> = [
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x06d6, 0x06ed],
]

function normalizeChar(ch: string): string | null {
  const code = ch.codePointAt(0)!
  if (code === 0x0640) return null // tatweel
  for (const [start, end] of DIACRITIC_RANGES) {
    if (code >= start && code <= end) return null
  }
  switch (ch) {
    case 'أ':
    case 'إ':
    case 'آ':
    case 'ٱ':
      return 'ا'
    case 'ى':
      return 'ي'
    case 'ة':
      return 'ه'
    case 'ؤ':
      return 'و'
    case 'ئ':
      return 'ي'
    default:
      return ch.toLowerCase()
  }
}

interface Normalized {
  text: string
  /** normalized[i] came from original[map[i]] */
  map: number[]
}

function normalize(text: string): Normalized {
  let out = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const n = normalizeChar(text[i])
    if (n === null) continue
    for (const c of n) {
      out += c
      map.push(i)
    }
  }
  return { text: out, map }
}

export interface RawMatch {
  start: number
  end: number
}

/** Finds every occurrence of `query` inside `text`, tolerant of diacritics/case. */
export function findMatches(text: string, query: string, limit = 500): RawMatch[] {
  const q = normalize(query).text
  if (!q.trim()) return []
  const { text: n, map } = normalize(text)

  const results: RawMatch[] = []
  let from = 0
  while (results.length < limit) {
    const at = n.indexOf(q, from)
    if (at === -1) break
    const start = map[at]
    const lastIdx = at + q.length - 1
    const end = lastIdx < map.length - 1 ? map[lastIdx + 1] : map[lastIdx] + 1
    results.push({ start, end })
    from = at + q.length
  }
  return results
}

export interface Snippet {
  text: string
  matchStart: number
  matchEnd: number
}

/** Builds a short, readable excerpt of `text` around [start, end) with the match position preserved. */
export function buildSnippet(text: string, start: number, end: number, radius = 50): Snippet {
  const from = Math.max(0, start - radius)
  const to = Math.min(text.length, end + radius)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  // Flatten stray whitespace to plain spaces one-for-one (no collapsing) so offsets stay exact.
  const flat = text.slice(from, to).replace(/[\t\n\r\f\v]/g, ' ')
  const body = flat.trim()
  const leading = flat.length - flat.trimStart().length
  const matchStart = prefix.length + Math.max(0, start - from - leading)
  const matchEnd = Math.min(matchStart + (end - start), prefix.length + body.length)
  return { text: prefix + body + suffix, matchStart, matchEnd }
}

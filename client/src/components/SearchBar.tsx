interface Props {
  value: string
  onChange: (value: string) => void
  matchCount: number
  fileCount: number
  readyCount: number
}

export default function SearchBar({ value, onChange, matchCount, fileCount, readyCount }: Props) {
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-[#0b0d10]/95 px-4 py-3 backdrop-blur">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/40">🔎</span>
        <input
          type="search"
          value={value}
          dir="auto"
          onChange={(e) => onChange(e.target.value)}
          placeholder="ابحث عن كلمة أو عبارة داخل محتوى الملفات..."
          className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pr-10 pl-4 text-sm outline-none placeholder:text-white/35 focus:border-amber-400"
        />
      </div>
      {fileCount > 0 && (
        <p className="mt-2 text-xs text-white/40">
          {readyCount < fileCount
            ? `جاهز ${readyCount} من ${fileCount} ملف…`
            : value.trim()
              ? `${matchCount} نتيجة`
              : `${fileCount} ملف جاهز للبحث`}
        </p>
      )}
    </div>
  )
}

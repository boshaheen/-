import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getHistory, deleteEvaluation } from '../lib/storage'
import { gradeColor } from '../lib/grade'

export default function History() {
  const [items, setItems] = useState(getHistory())

  function handleDelete(id: string) {
    deleteEvaluation(id)
    setItems(getHistory())
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-white/60">لا توجد تقييمات محفوظة بعد</p>
        <Link
          to="/new?mode=camera"
          className="rounded-full bg-amber-400 px-6 py-3 font-bold text-black"
        >
          ابدأ أول تقييم
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <h1 className="text-xl font-bold text-white">سجل التقييمات</h1>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
          >
            <img
              src={item.imageDataUrl}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
            />
            <Link to={`/result/${item.id}`} className="flex-1">
              <p className="font-bold text-white">{item.camelName || 'ناقة بدون اسم'}</p>
              <p className="text-xs text-white/40">
                {new Date(item.createdAt).toLocaleDateString('ar-SA')}
              </p>
            </Link>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-black"
              style={{ backgroundColor: gradeColor(item.grade) }}
            >
              {item.overallScore}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              aria-label="حذف"
              className="text-white/30 hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

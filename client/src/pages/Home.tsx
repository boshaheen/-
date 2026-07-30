import { useNavigate } from 'react-router-dom'
import { CAMEL_TRAITS } from '../types'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-1 flex-col items-center gap-8 py-8 text-center">
      <div>
        <h1 className="text-3xl font-black text-white sm:text-4xl">
          قيّم جمال ناقتك بالذكاء الاصطناعي
        </h1>
        <p className="mt-3 text-white/60">
          صوّر ناقتك مباشرة أو ارفع صورة، وسيقوم الذكاء الاصطناعي بتحليل علامات الجمال
          وإعطائك تقييمًا تفصيليًا قابلًا للتصدير والمشاركة
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/new?mode=camera')}
          className="flex items-center justify-center gap-3 rounded-2xl bg-amber-400 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-amber-400/20 transition hover:bg-amber-300"
        >
          📷 تصوير مباشر
        </button>
        <button
          type="button"
          onClick={() => navigate('/new?mode=upload')}
          className="flex items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-lg font-bold text-white transition hover:bg-white/10"
        >
          🖼️ رفع صورة
        </button>
      </div>

      <div className="mt-4 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-right">
        <h2 className="mb-3 text-base font-bold text-amber-300">معايير التقييم</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-white/70">
          {CAMEL_TRAITS.map((trait) => (
            <li key={trait.key} className="flex items-center justify-between gap-2">
              <span>{trait.nameAr}</span>
              <span className="text-white/40">{trait.weight}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

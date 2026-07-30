import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getEvaluation } from '../lib/storage'
import { gradeColor } from '../lib/grade'
import { renderNodeToPdf, downloadPdf } from '../lib/pdf'
import { buildWhatsAppText, openWhatsAppShare, shareFile, base64ToFile } from '../lib/share'
import { emailReport } from '../lib/api'
import ScoreRadar from '../components/ScoreRadar'

export default function Result() {
  const { id } = useParams<{ id: string }>()
  const result = id ? getEvaluation(id) : undefined
  const reportRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'share' | 'email' | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (!result) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-white/70">لم يتم العثور على هذا التقييم</p>
        <Link to="/" className="text-amber-300 underline">
          العودة للرئيسية
        </Link>
      </div>
    )
  }

  const fileName = `تقييم-${result.camelName || 'الناقة'}-${result.id.slice(0, 6)}.pdf`

  async function handleDownloadPdf() {
    if (!reportRef.current) return
    setBusy('pdf')
    setActionError(null)
    try {
      const { pdf } = await renderNodeToPdf(reportRef.current, fileName)
      downloadPdf(pdf, fileName)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذّر تصدير التقرير')
    } finally {
      setBusy(null)
    }
  }

  async function handleShare() {
    if (!reportRef.current || !result) return
    setBusy('share')
    setActionError(null)
    try {
      const text = buildWhatsAppText(result)
      const { base64 } = await renderNodeToPdf(reportRef.current, fileName)
      const file = base64ToFile(base64, fileName)
      const shared = await shareFile(file, text)
      if (!shared) openWhatsAppShare(text)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'تعذّرت المشاركة')
    } finally {
      setBusy(null)
    }
  }

  async function handleSendEmail() {
    if (!reportRef.current || !result || !email) return
    setBusy('email')
    setEmailStatus(null)
    try {
      const { base64 } = await renderNodeToPdf(reportRef.current, fileName)
      await emailReport({
        to: email,
        camelName: result.camelName,
        overallScore: result.overallScore,
        grade: result.grade,
        pdfBase64: base64,
        fileName,
      })
      setEmailStatus('تم إرسال التقرير بنجاح ✅')
    } catch (e) {
      setEmailStatus(e instanceof Error ? e.message : 'تعذّر إرسال البريد')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-6">
      <div ref={reportRef} className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-[#0b0d10] p-5">
        <div className="flex flex-col items-center gap-3">
          <img
            src={result.imageDataUrl}
            alt={result.camelName || 'صورة الناقة'}
            className="max-h-72 w-full max-w-md rounded-2xl object-contain"
          />
          {result.camelName && (
            <h2 className="text-xl font-bold text-white">{result.camelName}</h2>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-8 text-3xl font-black text-white"
            style={{ borderColor: gradeColor(result.grade) }}
          >
            {result.overallScore}
            <span className="text-xs font-normal text-white/50">من 100</span>
          </div>
          <span
            className="rounded-full px-4 py-1 text-sm font-bold text-black"
            style={{ backgroundColor: gradeColor(result.grade) }}
          >
            {result.grade}
          </span>
        </div>

        <p className="text-center text-sm leading-7 text-white/70">{result.summary}</p>

        <ScoreRadar traits={result.traits} />

        <div className="flex flex-col gap-3">
          {result.traits.map((trait) => (
            <div key={trait.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold text-white">{trait.nameAr}</span>
                <span className="text-sm text-amber-300">{trait.score}/100</span>
              </div>
              <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${trait.score}%` }}
                />
              </div>
              <p className="text-xs text-white/50">{trait.notes}</p>
            </div>
          ))}
        </div>

        {result.recommendations.length > 0 && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
            <h3 className="mb-2 font-bold text-amber-300">توصيات</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-white/70">
              {result.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-[10px] text-white/30">
          {new Date(result.createdAt).toLocaleString('ar-SA')} — مُقيّم الإبل الذكي
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {actionError && (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-2 text-center text-xs text-red-300">
            {actionError}
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={busy !== null}
            className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {busy === 'pdf' ? 'جاري التصدير...' : '📄 تصدير PDF'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={busy !== null}
            className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {busy === 'share' ? 'جاري المشاركة...' : '📤 مشاركة واتساب'}
          </button>
        </div>

        {!emailOpen ? (
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="rounded-xl bg-amber-400 py-3 text-sm font-bold text-black hover:bg-amber-300"
          >
            ✉️ إرسال بالبريد الإلكتروني
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-white/15 bg-white/5 p-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="البريد الإلكتروني للمستلم"
              dir="ltr"
              className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-white placeholder:text-white/30 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={busy !== null || !email}
              className="rounded-lg bg-amber-400 py-2 text-sm font-bold text-black hover:bg-amber-300 disabled:opacity-50"
            >
              {busy === 'email' ? 'جاري الإرسال...' : 'إرسال التقرير'}
            </button>
            {emailStatus && <p className="text-center text-xs text-white/70">{emailStatus}</p>}
          </div>
        )}

        <Link
          to="/new?mode=camera"
          className="text-center text-sm text-white/50 underline underline-offset-4"
        >
          تقييم ناقة أخرى
        </Link>
      </div>
    </div>
  )
}

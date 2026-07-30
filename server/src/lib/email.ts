import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendReportEmail(params: {
  to: string
  camelName?: string
  overallScore: number
  grade: string
  pdfBase64: string
  fileName: string
}): Promise<void> {
  if (!resend) {
    throw new Error('خدمة البريد الإلكتروني غير مُفعّلة على الخادم (RESEND_API_KEY مفقود)')
  }

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const subjectName = params.camelName ? `الناقة "${params.camelName}"` : 'الناقة'

  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: `تقرير تقييم علامات الجمال - ${subjectName}`,
    html: `
      <div dir="rtl" style="font-family: Tahoma, sans-serif; text-align: right;">
        <h2>تقرير تقييم ${subjectName}</h2>
        <p>النتيجة الإجمالية: <strong>${params.overallScore}/100</strong></p>
        <p>المستوى: <strong>${params.grade}</strong></p>
        <p>مرفق التقرير التفصيلي بصيغة PDF.</p>
        <hr />
        <p style="color:#888; font-size:12px;">تم الإنشاء بواسطة مُقيّم الإبل الذكي</p>
      </div>
    `,
    attachments: [
      {
        filename: params.fileName,
        content: params.pdfBase64,
      },
    ],
  })

  if (error) {
    throw new Error(error.message || 'تعذّر إرسال البريد الإلكتروني')
  }
}

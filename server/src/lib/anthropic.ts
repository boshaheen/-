import Anthropic from '@anthropic-ai/sdk'
import https from 'node:https'
import { CAMEL_TRAITS, type AnalyzeResult, type TraitScore } from '../types.js'
import { gradeFromScore } from './grade.js'
import { parseImageDataUrl } from './imageData.js'

// Serverless runtimes (Vercel/Lambda) freeze processes between invocations,
// which can leave pooled keep-alive sockets stale and cause the next request
// to fail with "Premature close". Disabling keep-alive avoids reusing them.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  httpAgent: new https.Agent({ keepAlive: false }),
})
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

const TOOL_NAME = 'submit_camel_evaluation'

const traitKeyEnum = CAMEL_TRAITS.map((t) => t.key)

const systemPrompt = `أنت خبير حَكَم مخضرم في مزايين الإبل (مسابقات جمال الإبل الخليجية التقليدية)، معروف بالدقة والصرامة في التقييم وعدم التساهل في الدرجات.

مهمتك: تحليل صورة ناقة بعين ناقدة تفصيلية، وتقييم كل صفة من الصفات الثمانية التالية بدرجة من 0 إلى 100:

${CAMEL_TRAITS.map((t) => `- ${t.key}: ${t.nameAr}`).join('\n')}

قواعد صارمة في التقييم:
- كن ناقدًا دقيقًا لا متساهلًا. لا تمنح درجات عالية إلا لصفات تستحقها فعلًا بناءً على ما تراه بوضوح في الصورة.
- استخدم كامل مدى الدرجات (0-100) بشكل متمايز بين الصفات المختلفة، بدل تكرار درجات متقاربة لجميع الصفات.
- سلّم الدرجات وفق هذا المعيار التقريبي: 90+ يعني صفة استثنائية نادرة بلا أي عيب ظاهر، 75-89 صفة جيدة جدًا بعيوب طفيفة جدًا، 60-74 صفة جيدة بها نقاط تحتاج تحسينًا واضحًا، 40-59 صفة متوسطة بعيوب متعددة ملحوظة، أقل من 40 صفة ضعيفة بعيوب واضحة تؤثر على المظهر العام.
- كل "notes" يجب أن تذكر تفصيلًا بصريًا محددًا فعليًا رأيته في هذه الصورة تحديدًا (مثل: زاوية معينة، تفاوت لون، عيب أو ميزة واضحة)، وليس وصفًا عامًا يصلح لأي ناقة. اكتب سطرًا إلى سطرين لكل صفة.
- إذا كانت الصورة غير واضحة لصفة معينة أو محجوبة جزئيًا، اذكر ذلك صراحة في الملاحظة وقلّل درجة الثقة في التقدير بدل إعطاء درجة متوسطة افتراضية.

معايير عامة يجب مراعاتها عند التقييم:
- تناسق الرأس مع الجسم، واستقامة وطول الرقبة، وتناسب حجم وشكل الأذنين
- جمال وتناسق المشافر (الشفاه)، وموضع وحجم واستقامة السنام
- استقامة وقوة الهيكل العام والجسم وتناسب الأبعاد، وسلامة واستقامة القوائم
- نعومة ولون الوبر وسلامة الجلد الظاهر

اكتب "summary" كفقرة من 2-3 جمل تلخص الانطباع العام بأسلوب حكم مزايين محترف وناقد، تذكر أبرز نقاط القوة والضعف الفعلية بالصورة.
اكتب "recommendations" كقائمة من 2-4 نصائح عملية محددة (لا عامة) مبنية على العيوب الفعلية التي رصدتها.

أجب حصرًا عبر استدعاء الأداة المتاحة، بدون أي نص خارج الأداة.`

const inputSchema = {
  type: 'object' as const,
  properties: {
    summary: { type: 'string', description: 'فقرة تلخيصية عامة عن جمال الناقة' },
    traits: {
      type: 'array',
      minItems: CAMEL_TRAITS.length,
      maxItems: CAMEL_TRAITS.length,
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', enum: traitKeyEnum },
          score: { type: 'integer', minimum: 0, maximum: 100 },
          notes: { type: 'string' },
        },
        required: ['key', 'score', 'notes'],
      },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'traits', 'recommendations'],
}

interface ToolOutput {
  summary: string
  traits: { key: string; score: number; notes: string }[]
  recommendations: string[]
}

export async function analyzeCamelPhoto(
  imageDataUrl: string,
  camelName?: string,
): Promise<AnalyzeResult> {
  const { mediaType, base64 } = parseImageDataUrl(imageDataUrl)

  const userText = camelName
    ? `قيّم الناقة التالية (اسمها: ${camelName}) بناءً على الصورة المرفقة.`
    : 'قيّم الناقة الظاهرة في الصورة المرفقة.'

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    tools: [
      {
        name: TOOL_NAME,
        description: 'تسجيل نتيجة تقييم علامات جمال الناقة',
        input_schema: inputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  })

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  )

  if (!toolUse) {
    throw new Error('تعذّر الحصول على نتيجة تحليل من نموذج الذكاء الاصطناعي')
  }

  const output = toolUse.input as ToolOutput

  const traits: TraitScore[] = CAMEL_TRAITS.map((def) => {
    const found = output.traits.find((t) => t.key === def.key)
    const score = Math.max(0, Math.min(100, Math.round(found?.score ?? 0)))
    return {
      key: def.key,
      nameAr: def.nameAr,
      weight: def.weight,
      score,
      notes: found?.notes || '',
    }
  })

  const overallScore = Math.round(
    traits.reduce((sum, t) => sum + t.score * t.weight, 0) / 100,
  )

  return {
    overallScore,
    grade: gradeFromScore(overallScore),
    summary: output.summary,
    traits,
    recommendations: output.recommendations ?? [],
  }
}

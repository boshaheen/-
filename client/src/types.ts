export interface TraitDefinition {
  key: string
  nameAr: string
  weight: number
}

export const CAMEL_TRAITS: TraitDefinition[] = [
  { key: 'head', nameAr: 'الرأس', weight: 15 },
  { key: 'neck', nameAr: 'الرقبة', weight: 10 },
  { key: 'ears', nameAr: 'الأذنان', weight: 10 },
  { key: 'lips', nameAr: 'المشافر (الشفاه)', weight: 10 },
  { key: 'hump', nameAr: 'السنام', weight: 15 },
  { key: 'body', nameAr: 'الهيكل العام والجسم', weight: 20 },
  { key: 'legs', nameAr: 'القوائم', weight: 10 },
  { key: 'coat', nameAr: 'اللون وجودة الوبر', weight: 10 },
]

export interface TraitScore {
  key: string
  nameAr: string
  score: number
  weight: number
  notes: string
}

export type Grade = 'ممتاز' | 'جيد جدًا' | 'جيد' | 'متوسط' | 'ضعيف'

export interface EvaluationResult {
  id: string
  createdAt: string
  imageDataUrl: string
  overallScore: number
  grade: Grade
  summary: string
  traits: TraitScore[]
  recommendations: string[]
  camelName?: string
}

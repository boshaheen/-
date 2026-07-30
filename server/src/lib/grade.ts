import type { Grade } from '../types.js'

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'ممتاز'
  if (score >= 75) return 'جيد جدًا'
  if (score >= 60) return 'جيد'
  if (score >= 40) return 'متوسط'
  return 'ضعيف'
}

import type { Grade } from '../types'

export function gradeColor(grade: Grade): string {
  switch (grade) {
    case 'ممتاز':
      return '#22c55e'
    case 'جيد جدًا':
      return '#84cc16'
    case 'جيد':
      return '#fbbf24'
    case 'متوسط':
      return '#f97316'
    case 'ضعيف':
    default:
      return '#ef4444'
  }
}

export function gradeFromScore(score: number): Grade {
  if (score >= 90) return 'ممتاز'
  if (score >= 75) return 'جيد جدًا'
  if (score >= 60) return 'جيد'
  if (score >= 40) return 'متوسط'
  return 'ضعيف'
}

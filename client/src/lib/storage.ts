import type { EvaluationResult } from '../types'

const STORAGE_KEY = 'camel-evaluations'
const MAX_HISTORY = 30

export function saveEvaluation(result: EvaluationResult): void {
  const history = getHistory()
  history.unshift(result)
  const trimmed = history.slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // storage full (large images) - keep only the newest few
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed.slice(0, 5)))
  }
}

export function getHistory(): EvaluationResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function getEvaluation(id: string): EvaluationResult | undefined {
  return getHistory().find((e) => e.id === id)
}

export function deleteEvaluation(id: string): void {
  const history = getHistory().filter((e) => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}

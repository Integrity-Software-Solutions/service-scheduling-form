export type SopBranch =
  | 'roofing'
  | 'repairs'
  | 'gutters'
  | 'windows'
  | 'doors'
  | 'siding'
  | 'unknown'

export type SopQuestionType = 'text' | 'yesno' | 'checkbox'

export type SopAnswerValue = string | boolean | null

export type SopAnswers = Record<string, SopAnswerValue>

export interface SopQuestion {
  id: string
  prompt: string
  type: SopQuestionType
  /** Show only when this returns true given current answers. */
  visibleWhen?: (answers: SopAnswers) => boolean
  required?: boolean
  placeholder?: string
  helpText?: string
}

export interface SchedulingConstraints {
  /** ISO date — blocks before this date cannot be selected. */
  minDate?: string
  requireHomeConfirmed: boolean
  prioritizeNextAvailable: boolean
  banners: string[]
}

export type SopStatus = 'pending' | 'complete' | 'skipped'

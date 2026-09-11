import {
  BRANCH_LABELS,
  BRANCH_QUESTIONS,
  ISSUE_QUESTION,
  PRODUCT_BRANCH_MAP,
  SIDING_MATERIAL_LEAD_DAYS,
  UNKNOWN_QUESTIONS,
} from '@/lib/sop/config'
import type {
  SchedulingConstraints,
  SopAnswers,
  SopBranch,
  SopQuestion,
} from '@/lib/sop/types'
import { addDays, startOfToday, toISODate } from '@/lib/format'

export function resolveSopBranch(productLabel: string | null | undefined): SopBranch {
  if (!productLabel) return 'unknown'
  return PRODUCT_BRANCH_MAP[productLabel] ?? 'unknown'
}

export function getVisibleQuestions(
  branch: SopBranch,
  answers: SopAnswers,
  options?: { includeIssue?: boolean },
): SopQuestion[] {
  const includeIssue = options?.includeIssue ?? true
  const branchQuestions =
    branch === 'unknown' ? UNKNOWN_QUESTIONS : BRANCH_QUESTIONS[branch]

  const questions = includeIssue
    ? [ISSUE_QUESTION, ...branchQuestions]
    : branchQuestions

  return questions.filter((q) => (q.visibleWhen ? q.visibleWhen(answers) : true))
}

function isAnswered(question: SopQuestion, answers: SopAnswers): boolean {
  const value = answers[question.id]
  if (question.type === 'checkbox') {
    // Optional checkboxes are always "answered".
    if (!question.required) return true
    return value === true
  }
  if (question.type === 'yesno') {
    return value === true || value === false
  }
  return typeof value === 'string' && value.trim().length > 0
}

export function isSopComplete(branch: SopBranch, answers: SopAnswers): boolean {
  const visible = getVisibleQuestions(branch, answers)
  return visible.every((q) => !q.required || isAnswered(q, answers))
}

export function getSchedulingConstraints(
  branch: SopBranch,
  answers: SopAnswers,
): SchedulingConstraints {
  const banners: string[] = []
  let minDate: string | undefined
  let requireHomeConfirmed = false
  let prioritizeNextAvailable = false

  if (answers.activeLeak === true) {
    prioritizeNextAvailable = true
    banners.push('Active leak — prioritize the next available appointment.')
  }

  if (branch === 'windows' || branch === 'doors') {
    requireHomeConfirmed = true
    if (answers.homeConfirmed !== true) {
      banners.push('Homeowner must be home. Confirm before scheduling.')
    }
  }

  if (branch === 'siding' && answers.reusable === false) {
    minDate = toISODate(addDays(startOfToday(), SIDING_MATERIAL_LEAD_DAYS))
    banners.push(
      `Product not re-usable — schedule at least ${SIDING_MATERIAL_LEAD_DAYS} days out so material can be ordered.`,
    )
    if (answers.materialScriptExplained !== true) {
      banners.push('Explain the ~2 week material lead time to the homeowner before scheduling.')
    }
  }

  if (branch === 'roofing' || branch === 'repairs' || branch === 'gutters' || branch === 'siding') {
    banners.push('Exterior product — homeowner does not need to be home.')
  }

  if (answers.escalateMatt === true) {
    banners.push('Escalate timeframe pushback to Matt if needed.')
  }

  return {
    minDate,
    requireHomeConfirmed,
    prioritizeNextAvailable,
    banners,
  }
}

function yn(value: string | boolean | null | undefined): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

export function composeSopNotes(input: {
  productLabel: string
  branch: SopBranch
  answers: SopAnswers
  agent?: string | null
}): string {
  const { productLabel, branch, answers, agent } = input
  const lines: string[] = [
    'WARRANTY INTAKE',
    `Product: ${productLabel} (${BRANCH_LABELS[branch]})`,
  ]

  if (typeof answers.issue === 'string' && answers.issue.trim()) {
    lines.push(`Issue: ${answers.issue.trim()}`)
  }

  lines.push('')

  if (typeof answers.location === 'string' && answers.location.trim()) {
    lines.push(`Location: ${answers.location.trim()}`)
  }

  if (answers.activeLeak === true || answers.activeLeak === false) {
    lines.push(`Active leak: ${yn(answers.activeLeak)}`)
  }

  if (typeof answers.leakLocation === 'string' && answers.leakLocation.trim()) {
    lines.push(`Leak location: ${answers.leakLocation.trim()}`)
  }

  if (answers.productOff === true || answers.productOff === false) {
    lines.push(`Product off house: ${yn(answers.productOff)}`)
  }

  if (typeof answers.whatFellOff === 'string' && answers.whatFellOff.trim()) {
    lines.push(`What fell off: ${answers.whatFellOff.trim()}`)
  }

  if (answers.reusable === true || answers.reusable === false) {
    lines.push(`Reusable: ${yn(answers.reusable)}`)
  }

  if (answers.homeConfirmed === true || answers.homeConfirmed === false) {
    lines.push(`H/O will be home: ${yn(answers.homeConfirmed)}`)
  }

  if (answers.materialScriptExplained === true || answers.materialScriptExplained === false) {
    lines.push(`Material lead-time explained: ${yn(answers.materialScriptExplained)}`)
  }

  const scheduling: string[] = []
  if (answers.activeLeak === true) {
    scheduling.push('Active leak — next available preferred')
  }
  if (branch === 'siding' && answers.reusable === false) {
    scheduling.push(
      `Material order needed — schedule ≥ ${SIDING_MATERIAL_LEAD_DAYS} days out`,
    )
  }
  if (branch === 'windows' || branch === 'doors') {
    scheduling.push('Interior — H/O must be home')
  } else if (branch !== 'unknown') {
    scheduling.push('Exterior — H/O need not be home')
  }
  if (answers.escalateMatt === true) {
    scheduling.push('Escalate timeframe pushback to Matt')
  }

  if (scheduling.length) {
    lines.push('')
    lines.push('Scheduling:')
    for (const item of scheduling) lines.push(`- ${item}`)
  }

  if (agent) {
    lines.push('')
    lines.push(`Agent: ${agent}`)
  }

  return lines.join('\n')
}

/** Whether a calendar day ISO date is selectable given constraints. */
export function isDateSelectable(isoDate: string, minDate?: string): boolean {
  if (!minDate) return true
  return isoDate >= minDate
}

function parseYesNo(raw: string | undefined): boolean | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

export type ParsedSopNotes = {
  answers: SopAnswers
  productLabel?: string
  branch?: SopBranch
  agent?: string
}

/**
 * Reverse the WARRANTY INTAKE notes template into SOP answers.
 * Returns null when the notes don't look like our composed format.
 */
export function parseSopNotes(notes: string | null | undefined): ParsedSopNotes | null {
  if (!notes || !notes.includes('WARRANTY INTAKE')) return null

  const answers: SopAnswers = {}
  let productLabel: string | undefined
  let branch: SopBranch | undefined
  let agent: string | undefined

  const lines = notes.replace(/\r\n/g, '\n').split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line === 'WARRANTY INTAKE' || line === 'Scheduling:') continue

    const productMatch = /^Product:\s*(.+?)\s*\(([^)]+)\)\s*$/i.exec(line)
    if (productMatch) {
      productLabel = productMatch[1].trim()
      const branchLabel = productMatch[2].trim().toLowerCase()
      const found = (Object.entries(BRANCH_LABELS) as [SopBranch, string][]).find(
        ([, label]) => label.toLowerCase() === branchLabel,
      )
      branch = found?.[0] ?? resolveSopBranch(productLabel)
      continue
    }

    const issueMatch = /^Issue:\s*(.*)$/i.exec(line)
    if (issueMatch) {
      answers.issue = issueMatch[1].trim()
      continue
    }

    const locationMatch = /^Location:\s*(.*)$/i.exec(line)
    if (locationMatch) {
      answers.location = locationMatch[1].trim()
      continue
    }

    const activeLeakMatch = /^Active leak:\s*(.*)$/i.exec(line)
    if (activeLeakMatch) {
      const value = parseYesNo(activeLeakMatch[1])
      if (value !== null) answers.activeLeak = value
      continue
    }

    const leakLocationMatch = /^Leak location:\s*(.*)$/i.exec(line)
    if (leakLocationMatch) {
      answers.leakLocation = leakLocationMatch[1].trim()
      continue
    }

    const productOffMatch = /^Product off house:\s*(.*)$/i.exec(line)
    if (productOffMatch) {
      const value = parseYesNo(productOffMatch[1])
      if (value !== null) answers.productOff = value
      continue
    }

    const whatFellOffMatch = /^What fell off:\s*(.*)$/i.exec(line)
    if (whatFellOffMatch) {
      answers.whatFellOff = whatFellOffMatch[1].trim()
      continue
    }

    const reusableMatch = /^Reusable:\s*(.*)$/i.exec(line)
    if (reusableMatch) {
      const value = parseYesNo(reusableMatch[1])
      if (value !== null) answers.reusable = value
      continue
    }

    const homeMatch = /^H\/O will be home:\s*(.*)$/i.exec(line)
    if (homeMatch) {
      const value = parseYesNo(homeMatch[1])
      if (value !== null) answers.homeConfirmed = value
      continue
    }

    const materialMatch = /^Material lead-time explained:\s*(.*)$/i.exec(line)
    if (materialMatch) {
      const value = parseYesNo(materialMatch[1])
      if (value !== null) answers.materialScriptExplained = value
      continue
    }

    const agentMatch = /^Agent:\s*(.*)$/i.exec(line)
    if (agentMatch) {
      agent = agentMatch[1].trim()
      continue
    }

    if (/escalate timeframe pushback to matt/i.test(line)) {
      answers.escalateMatt = true
    }
  }

  const hasAnswers = Object.keys(answers).length > 0
  if (!hasAnswers && !productLabel) return null

  return { answers, productLabel, branch, agent }
}

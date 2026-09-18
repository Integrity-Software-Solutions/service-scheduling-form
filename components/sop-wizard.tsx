'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BRANCH_LABELS, ISSUE_QUESTION } from '@/lib/sop/config'
import {
  composeSopNotes,
  getSchedulingConstraints,
  getVisibleQuestions,
  isSopComplete,
  resolveSopBranch,
} from '@/lib/sop/engine'
import type { SopAnswers, SopQuestion, SopStatus } from '@/lib/sop/types'

export function SopWizard({
  productLabel,
  answers,
  onAnswersChange,
  status,
  onComplete,
  onSkip,
  onRestart,
  agent,
  productSlot,
}: {
  productLabel: string | null
  answers: SopAnswers
  onAnswersChange: (answers: SopAnswers) => void
  status: SopStatus
  onComplete: (notes: string) => void
  onSkip: () => void
  onRestart: () => void
  agent?: string | null
  /** Rendered after the issue question (e.g. product dropdown on create). */
  productSlot?: React.ReactNode
}) {
  const branch = resolveSopBranch(productLabel)
  const followUps = productLabel
    ? getVisibleQuestions(branch, answers, { includeIssue: false })
    : []
  const complete = Boolean(productLabel) && isSopComplete(branch, answers)
  const constraints = getSchedulingConstraints(branch, answers)

  function setAnswer(id: string, value: string | boolean | null) {
    onAnswersChange({ ...answers, [id]: value })
  }

  function handleApplyNotes() {
    if (!productLabel || !complete) return
    onComplete(
      composeSopNotes({
        productLabel,
        branch,
        answers,
        agent,
      }),
    )
  }

  if (status === 'skipped') {
    return (
      <section className="space-y-3">
        <Header />
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          SOP skipped — enter notes manually below. Incomplete notes may delay service.
        </div>
        <Button type="button" variant="outline" onClick={onRestart}>
          Restart SOP
        </Button>
      </section>
    )
  }

  if (status === 'complete') {
    return (
      <section className="space-y-3">
        <Header branchLabel={BRANCH_LABELS[branch]} />
        <div className="rounded-lg border border-avail-green/30 bg-avail-green/10 px-4 py-3 text-sm text-foreground">
          Intake complete. Notes were filled from your answers — you can still edit them below.
        </div>
        {constraints.banners.length > 0 && <BannerList banners={constraints.banners} />}
        <Button type="button" variant="outline" onClick={onRestart}>
          Edit answers
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="sop-heading">
      <Header branchLabel={productLabel ? BRANCH_LABELS[branch] : undefined} />

      <div className="space-y-5">
        <QuestionField question={ISSUE_QUESTION} answers={answers} onAnswer={setAnswer} />

        {productSlot ? <div className="border-t border-border pt-5">{productSlot}</div> : null}

        {!productLabel ? (
          <p className="text-sm text-muted-foreground">
            After capturing the issue, confirm which product they&apos;re calling about to
            continue intake.
          </p>
        ) : (
          <>
            {branch === 'unknown' && (
              <div className="flex items-start gap-2 rounded-lg border border-avail-yellow/50 bg-avail-yellow-muted px-3 py-2 text-sm text-avail-yellow-emphasis">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  This product isn&apos;t mapped to a standard warranty path. Capture location
                  details, then continue.
                </p>
              </div>
            )}

            {followUps.map((question) => (
              <QuestionField
                key={question.id}
                question={question}
                answers={answers}
                onAnswer={setAnswer}
              />
            ))}
          </>
        )}
      </div>

      {productLabel && constraints.banners.length > 0 && (
        <BannerList banners={constraints.banners} />
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Skip SOP and enter notes manually
        </button>
        <Button type="button" onClick={handleApplyNotes} disabled={!complete}>
          Apply answers to notes
        </Button>
      </div>
    </section>
  )
}

function QuestionField({
  question,
  answers,
  onAnswer,
}: {
  question: SopQuestion
  answers: SopAnswers
  onAnswer: (id: string, value: string | boolean | null) => void
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={`sop-${question.id}`} className="text-sm font-medium text-foreground">
        {question.prompt}
        {question.required ? <span className="text-avail-red"> *</span> : null}
      </label>
      {question.helpText ? (
        <p className="text-xs text-muted-foreground">{question.helpText}</p>
      ) : null}

      {question.type === 'text' ? (
        <textarea
          id={`sop-${question.id}`}
          rows={question.id === 'issue' ? 4 : 2}
          value={typeof answers[question.id] === 'string' ? answers[question.id] : ''}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          placeholder={question.placeholder}
          className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      ) : null}

      {question.type === 'yesno' ? (
        <div className="flex gap-2">
          <YesNoButton
            label="Yes"
            pressed={answers[question.id] === true}
            onClick={() => onAnswer(question.id, true)}
          />
          <YesNoButton
            label="No"
            pressed={answers[question.id] === false}
            onClick={() => onAnswer(question.id, false)}
          />
        </div>
      ) : null}

      {question.type === 'checkbox' ? (
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            id={`sop-${question.id}`}
            type="checkbox"
            checked={answers[question.id] === true}
            onChange={(e) => onAnswer(question.id, e.target.checked)}
            className="size-4 rounded border-input"
          />
          Yes
        </label>
      ) : null}
    </div>
  )
}

function Header({ branchLabel }: { branchLabel?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="sop-heading" className="text-sm font-semibold text-foreground">
        Warranty intake
      </h2>
      {branchLabel ? (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {branchLabel}
        </span>
      ) : null}
    </div>
  )
}

function BannerList({ banners }: { banners: string[] }) {
  return (
    <ul className="space-y-2">
      {banners.map((banner) => (
        <li
          key={banner}
          className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>{banner}</span>
        </li>
      ))}
    </ul>
  )
}

function YesNoButton({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

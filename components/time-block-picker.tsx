'use client'

import { Ban, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AvailabilityFlag, TimeBlock } from '@/lib/types'
import {
  addDays,
  formatDayNumber,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  isSameDay,
  startOfToday,
  toISODate,
} from '@/lib/format'
import { isDateSelectable } from '@/lib/sop/engine'

const flagClasses: Record<AvailabilityFlag, string> = {
  green: 'bg-avail-green text-avail-green-foreground',
  yellow: 'bg-avail-yellow text-avail-yellow-foreground',
  red: 'bg-avail-red text-avail-red-foreground',
  blocked:
    'border border-dashed border-muted-foreground/45 bg-transparent text-muted-foreground shadow-none',
}

function BlockButton({
  block,
  selected,
  disabled,
  onSelect,
}: {
  block: TimeBlock
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const isBlocked = block.flag === 'blocked'

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={
        isBlocked
          ? `${formatTimeRange(block.startTime, block.endTime)}, not recommended`
          : undefined
      }
      title={isBlocked ? 'Not recommended' : undefined}
      className={`relative flex w-full items-center justify-center gap-1 rounded-md px-2 py-2.5 text-center text-xs font-semibold shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        disabled
          ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
          : `${flagClasses[block.flag]} hover:-translate-y-0.5`
      } ${selected && !disabled ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}
    >
      {isBlocked && !disabled ? (
        <Ban className="size-3 shrink-0 opacity-70" aria-hidden />
      ) : null}
      {formatTimeRange(block.startTime, block.endTime)}
      {selected && !disabled && (
        <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
          <Check className="size-3" />
        </span>
      )}
    </button>
  )
}

export function TimeBlockPicker({
  blocks,
  selectedId,
  onSelect,
  weekOffset,
  onWeekOffsetChange,
  isLoading = false,
  minDate,
}: {
  blocks: TimeBlock[]
  selectedId: string | null
  onSelect: (block: TimeBlock) => void
  weekOffset: number
  onWeekOffsetChange: (offset: number) => void
  isLoading?: boolean
  /** ISO date — blocks on earlier days cannot be selected. */
  minDate?: string
}) {
  const today = startOfToday()

  // The 7 days shown in the current window.
  const weekStart = addDays(today, weekOffset * 7)
  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)))

  const byDate = blocks.reduce<Record<string, TimeBlock[]>>((acc, block) => {
    ;(acc[block.date] ??= []).push(block)
    return acc
  }, {})

  const rangeLabel = `${formatShortDate(days[0])} – ${formatShortDate(days[6])}`

  function handleSelect(block: TimeBlock) {
    if (block.flag === 'blocked' && selectedId !== block.id) {
      const confirmed = window.confirm(
        'This time slot is not recommended due to drive time. Continue anyway?',
      )
      if (!confirmed) return
    }
    onSelect(block)
  }

  return (
    <section aria-labelledby="schedule-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="schedule-heading" className="text-sm font-semibold text-foreground">
          Select a Time Block
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onWeekOffsetChange(Math.max(0, weekOffset - 1))}
            disabled={weekOffset === 0}
            aria-label="Previous week"
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-medium text-foreground">
            {rangeLabel}
          </span>
          <button
            type="button"
            onClick={() => onWeekOffsetChange(weekOffset + 1)}
            aria-label="Next week"
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {minDate ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Earliest selectable date: {formatShortDate(minDate)}
        </p>
      ) : null}

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[680px] grid-cols-7 gap-2">
          {days.map((iso) => {
            const daySlots = byDate[iso] ?? []
            const isToday = isSameDay(iso, today)
            const dayAllowed = isDateSelectable(iso, minDate)
            return (
              <div key={iso} className="flex flex-col gap-2">
                <div
                  className={`rounded-md py-1.5 text-center ${
                    isToday ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                  } ${!dayAllowed ? 'opacity-50' : ''}`}
                >
                  <div className="text-[11px] font-medium uppercase tracking-wide">
                    {formatWeekday(iso)}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {formatDayNumber(iso)}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
                    ))
                  ) : daySlots.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border py-3 text-center text-xs text-muted-foreground">
                      —
                    </div>
                  ) : (
                    daySlots.map((block) => (
                      <BlockButton
                        key={block.id}
                        block={block}
                        selected={selectedId === block.id}
                        disabled={!dayAllowed}
                        onSelect={() => handleSelect(block)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function TimeBlockPickerSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, d) => (
          <div key={d} className="flex flex-col gap-2">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

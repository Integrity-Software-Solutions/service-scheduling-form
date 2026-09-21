'use client'

export function NotesField({
  value,
  onChange,
  hint = 'Pre-filled from ticket',
  required = false,
}: {
  value: string
  onChange: (value: string) => void
  hint?: string
  required?: boolean
}) {
  return (
    <section aria-labelledby="notes-heading">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label id="notes-heading" htmlFor="ticket-notes" className="text-sm font-semibold text-foreground">
          Notes{required ? <span className="text-avail-red"> *</span> : null}
        </label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <textarea
        id="ticket-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        required={required}
        className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        placeholder="Add scheduling notes for the technician…"
      />
    </section>
  )
}

export function NotesFieldSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
      <div className="h-28 animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

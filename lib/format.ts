export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWeekday(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

export function formatDayNumber(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric' })
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** True when SchedSvcDate is a real scheduled date (not empty / MySQL zero-date). */
export function hasSchedSvcDate(value: string | null | undefined): boolean {
  if (value == null) return false
  const s = String(value).trim()
  if (!s) return false
  if (/^0000-00-00/.test(s)) return false
  return true
}

/** Ticket is already scheduled when SchedSvcDate is present. */
export function isTicketScheduled(ticket: { schedSvcDate?: string | null }): boolean {
  return hasSchedSvcDate(ticket.schedSvcDate)
}

/** Normalize a date or datetime string to YYYY-MM-DD when possible. */
export function toISODatePart(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  if (match) return match[1]
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed)
  return value.trim()
}

/** HH:mm from a datetime string when a non-midnight time is present. */
function timeFromDateTime(value: string): string | undefined {
  const match = /^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/.exec(value.trim())
  if (!match) return undefined
  const hhmm = `${match[1]}:${match[2]}`
  return hhmm === '00:00' ? undefined : hhmm
}

/** Human-readable current appointment for a scheduled ticket. */
export function formatScheduledAppointment(ticket: {
  schedSvcDate?: string | null
  schedStartTime?: string | null
  schedEndTime?: string | null
}): string | null {
  if (!hasSchedSvcDate(ticket.schedSvcDate)) return null
  const raw = String(ticket.schedSvcDate).trim()
  const dateLabel = formatDate(toISODatePart(raw))

  const start = ticket.schedStartTime?.trim() || timeFromDateTime(raw)
  const end = ticket.schedEndTime?.trim()
  if (start && end) return `${dateLabel}, ${formatTimeRange(start, end)}`
  if (start) return `${dateLabel}, ${formatTime(start)}`
  return dateLabel
}

export function isSameDay(iso: string, date: Date): boolean {
  return iso === toISODate(date)
}

/** Inclusive ISO date range for a week window starting `weekOffset` weeks from today. */
export function weekDateRange(weekOffset: number): { startDate: string; endDate: string } {
  const weekStart = addDays(startOfToday(), weekOffset * 7)
  return {
    startDate: toISODate(weekStart),
    endDate: toISODate(addDays(weekStart, 6)),
  }
}


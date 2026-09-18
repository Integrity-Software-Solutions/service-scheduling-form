'use client'

import { AlertTriangle, CalendarClock, Plus } from 'lucide-react'
import { formatScheduledAppointment, isTicketScheduled } from '@/lib/format'
import type { ServiceTicket } from '@/lib/types'

const scheduledAlertBox =
  'rounded-xl border-2 border-avail-yellow bg-avail-yellow-muted px-4 py-4 shadow-sm text-avail-yellow-emphasis'
const scheduledTicketCard =
  'flex w-full items-start gap-3 rounded-xl border-2 border-avail-yellow bg-avail-yellow-muted px-4 py-4 text-left shadow-sm transition-colors hover:brightness-95 dark:hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-avail-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function ExistingTicketPicker({
  tickets,
  onSelectTicket,
  onCreateNew,
}: {
  tickets: ServiceTicket[]
  onSelectTicket: (ticket: ServiceTicket) => void
  onCreateNew: () => void
}) {
  const scheduledTickets = tickets.filter(isTicketScheduled)
  const unscheduledTickets = tickets.filter((t) => !isTicketScheduled(t))
  // Scheduled first so agents see existing appointments before open tickets.
  const orderedTickets = [...scheduledTickets, ...unscheduledTickets]
  const hasScheduled = scheduledTickets.length > 0

  return (
    <section aria-labelledby="existing-ticket-heading" className="space-y-4">
      {hasScheduled ? (
        <div role="alert" className={scheduledAlertBox}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold uppercase tracking-wide">
                {scheduledTickets.length === 1
                  ? 'This customer already has a scheduled appointment'
                  : `This customer already has ${scheduledTickets.length} scheduled appointments`}
              </p>
              <p className="mt-1 text-sm font-medium opacity-90">
                Do not create a duplicate ticket unless the homeowner needs a separate service.
                Reschedule the existing ticket below if the date or time needs to change.
              </p>
              <ul className="mt-3 space-y-1.5">
                {scheduledTickets.map((ticket) => {
                  const label = formatScheduledAppointment(ticket)
                  return (
                    <li
                      key={ticket.ticketId}
                      className="rounded-md border border-avail-yellow/40 bg-card/80 px-3 py-2 text-sm font-semibold text-foreground"
                    >
                      Ticket {ticket.ticketId} — {ticket.productid}
                      {label ? (
                        <span className="mt-0.5 block text-sm font-bold text-avail-yellow-emphasis">
                          {label}
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <h2 id="existing-ticket-heading" className="text-sm font-semibold text-foreground">
          Open service tickets
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasScheduled
            ? 'Scheduled tickets are listed first and highlighted. Select one to reschedule, or create a new ticket only if needed.'
            : `This customer has open service ticket${tickets.length === 1 ? '' : 's'}. Schedule one of them, or create a new ticket.`}
        </p>
      </div>

      <ul className="space-y-3">
        {orderedTickets.map((ticket) => {
          const scheduled = isTicketScheduled(ticket)
          const scheduledLabel = formatScheduledAppointment(ticket)
          return (
            <li key={ticket.ticketId}>
              <button
                type="button"
                onClick={() => onSelectTicket(ticket)}
                className={
                  scheduled
                    ? scheduledTicketCard
                    : 'flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                }
              >
                <CalendarClock
                  className={
                    scheduled
                      ? 'mt-0.5 size-5 shrink-0 text-avail-yellow-emphasis'
                      : 'mt-0.5 size-4 shrink-0 text-primary'
                  }
                />
                <div className="min-w-0 flex-1">
                  {scheduled ? (
                    <p className="mb-2 inline-flex items-center rounded-md bg-avail-yellow px-2 py-1 text-xs font-bold uppercase tracking-wide text-avail-yellow-foreground">
                      Already scheduled
                    </p>
                  ) : null}
                  <p
                    className={
                      scheduled
                        ? 'text-sm font-medium text-avail-yellow-emphasis'
                        : 'text-sm font-medium text-foreground'
                    }
                  >
                    Ticket {ticket.ticketId}
                    <span className={scheduled ? 'opacity-80' : 'text-muted-foreground'}>
                      {' '}
                      — {ticket.productid}
                    </span>
                    {ticket.status && !scheduled ? (
                      <span className="ml-2 inline-flex align-middle rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {ticket.status}
                      </span>
                    ) : null}
                  </p>
                  {scheduled && scheduledLabel ? (
                    <p className="mt-1.5 text-base font-bold text-avail-yellow-emphasis">
                      {scheduledLabel}
                    </p>
                  ) : null}
                  {ticket.notes ? (
                    <p
                      className={
                        scheduled
                          ? 'mt-1 line-clamp-2 text-xs text-avail-yellow-emphasis/80 text-pretty'
                          : 'mt-1 line-clamp-2 text-xs text-muted-foreground text-pretty'
                      }
                    >
                      {ticket.notes}
                    </p>
                  ) : (
                    <p
                      className={
                        scheduled
                          ? 'mt-1 text-xs text-avail-yellow-emphasis/70'
                          : 'mt-1 text-xs text-muted-foreground'
                      }
                    >
                      No notes yet
                    </p>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={onCreateNew}
        className={
          hasScheduled
            ? 'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-avail-yellow/50 bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : 'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        }
      >
        <Plus className="size-4" />
        {hasScheduled
          ? 'Create a new service ticket (only if this is a separate issue)'
          : 'Create a new service ticket'}
      </button>
    </section>
  )
}

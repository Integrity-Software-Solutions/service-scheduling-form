'use client'

import { CalendarClock, Plus } from 'lucide-react'
import type { ServiceTicket } from '@/lib/types'

export function ExistingTicketPicker({
  tickets,
  onSelectTicket,
  onCreateNew,
}: {
  tickets: ServiceTicket[]
  onSelectTicket: (ticket: ServiceTicket) => void
  onCreateNew: () => void
}) {
  return (
    <section aria-labelledby="existing-ticket-heading" className="space-y-4">
      <div>
        <h2 id="existing-ticket-heading" className="text-sm font-semibold text-foreground">
          Open service tickets
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This customer has open service ticket{tickets.length === 1 ? '' : 's'}. Schedule one of
          them, or create a new ticket.
        </p>
      </div>

      <ul className="space-y-2">
        {tickets.map((ticket) => (
          <li key={ticket.ticketId}>
            <button
              type="button"
              onClick={() => onSelectTicket(ticket)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Ticket {ticket.ticketId}
                  <span className="text-muted-foreground"> — {ticket.productid}</span>
                  {ticket.status ? (
                    <span className="ml-2 inline-flex align-middle rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {ticket.status}
                    </span>
                  ) : null}
                </p>
                {ticket.notes ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground text-pretty">
                    {ticket.notes}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No notes yet</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onCreateNew}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-4" />
        Create a new service ticket
      </button>
    </section>
  )
}

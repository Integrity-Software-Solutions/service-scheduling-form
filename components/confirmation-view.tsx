'use client'

import { CheckCircle2, CalendarClock, User, MapPin, Wrench, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ContactInfo, ScheduleConfirmation, TimeBlock } from '@/lib/types'
import { formatDate, formatTimeRange } from '@/lib/format'

export function ConfirmationView({
  confirmation,
  contact,
  onDone,
  title = 'Appointment Scheduled',
  subtitle,
}: {
  confirmation: ScheduleConfirmation
  contact: ContactInfo
  onDone: () => void
  title?: string
  subtitle?: string
}) {
  const block: TimeBlock | undefined = confirmation.block
  const address = `${contact.address1}, ${contact.city}, ${contact.state} ${contact.zip}`
  const scheduledDay = block ? formatDate(block.date) : null

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-avail-green/15">
            <CheckCircle2 className="size-8 text-avail-green" />
          </span>
          <h1 className="text-xl font-semibold text-foreground text-balance">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            {subtitle ?? `Recorded for ticket ${confirmation.ticketId}.`}
          </p>
          {confirmation.confirmationNumber ? (
            <p className="mt-3 rounded-full bg-muted px-3 py-1 font-mono text-sm font-semibold text-foreground">
              {confirmation.confirmationNumber}
            </p>
          ) : null}
        </div>

        <dl className="mt-8 space-y-4 border-t border-border pt-6">
          {contact.productLabel ? (
            <div className="flex items-start gap-3">
              <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Product</dt>
                <dd className="text-sm font-medium text-foreground">{contact.productLabel}</dd>
              </div>
            </div>
          ) : null}
          {block ? (
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Time Block</dt>
                <dd className="text-sm font-medium text-foreground">
                  {formatDate(block.date)}, {formatTimeRange(block.startTime, block.endTime)}
                </dd>
              </div>
            </div>
          ) : null}
          <div className="flex items-start gap-3">
            <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Homeowner</dt>
              <dd className="text-sm font-medium text-foreground">
                {contact.firstname} {contact.lastname}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Address</dt>
              <dd className="text-sm font-medium text-foreground text-pretty">{address}</dd>
            </div>
          </div>
        </dl>

        {block ? (
          <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-left">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquareText className="size-4 text-primary" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Closing script — read to homeowner
              </p>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-foreground">
              <p>
                Ok, I&apos;ve got you in the schedule. Our service tech will give you a call when he
                is on his way to give you an updated ETA. If he can fix that when he is out there
                then he will; if not, he will give us a material list of everything we need and we
                will get that taken care of for you.
              </p>
              <p className="text-xs italic text-muted-foreground">* Homeowner will respond *</p>
              <p>
                Awesome. You have a great day, and we will see you on{' '}
                <span className="font-semibold">{scheduledDay}</span>.
              </p>
            </div>
          </div>
        ) : null}

        <Button onClick={onDone} variant="outline" className="mt-8 w-full">
          Done
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { AlertCircle, CalendarClock, Check, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ServiceInfo, ServiceInfoSkeleton } from '@/components/service-info'
import { NotesField, NotesFieldSkeleton } from '@/components/notes-field'
import { ProductSelect, ProductSelectSkeleton } from '@/components/product-select'
import { TimeBlockPicker } from '@/components/time-block-picker'
import { ConfirmationView } from '@/components/confirmation-view'
import { SopWizard } from '@/components/sop-wizard'
import { ExistingTicketPicker } from '@/components/existing-ticket-picker'
import {
  fetchCustomerWithProducts,
  fetchServiceTicket,
  fetchTimeBlocks,
  postCreateTicket,
  postSchedule,
} from '@/lib/api'
import { canAccessScheduler } from '@/lib/access'
import { formatScheduledAppointment, isTicketScheduled, weekDateRange } from '@/lib/format'
import {
  composeSopNotes,
  getSchedulingConstraints,
  isDateSelectable,
  isSopComplete,
  parseSopNotes,
  resolveSopBranch,
} from '@/lib/sop/engine'
import type { SopAnswers, SopStatus } from '@/lib/sop/types'
import type {
  ContactInfo,
  CreateTicketResult,
  CustomerWithProducts,
  ScheduleConfirmation,
  ServiceTicket,
  TimeBlock,
} from '@/lib/types'

type CustomerPath = 'choose' | 'existing' | 'create'

export function Scheduler() {
  const searchParams = useSearchParams()
  const username = searchParams.get('username')
  const token = searchParams.get('token')
  const ticketId = searchParams.get('ticketId')
  const cstId = searchParams.get('cst_id')
  const canSchedule = canAccessScheduler(username)
  const apiAuth = { token, username }

  // cst_id + token are required for scoring / backend auth on every flow.
  // ticketId + cst_id = schedule that ticket; cst_id alone = customer hub (existing or create).
  const entry: 'url-ticket' | 'customer' | 'invalid' = !cstId || !token
    ? 'invalid'
    : ticketId
      ? 'url-ticket'
      : 'customer'

  const [weekOffset, setWeekOffset] = useState(0)
  const dateRange = weekDateRange(weekOffset)

  const [customerPath, setCustomerPath] = useState<CustomerPath | null>(null)
  const [selectedExistingTicket, setSelectedExistingTicket] = useState<ServiceTicket | null>(null)

  const {
    data: urlTicket,
    error: ticketError,
    isLoading: ticketLoading,
  } = useSWR<ServiceTicket>(
    entry === 'url-ticket' ? ['service-ticket', ticketId, token, username] : null,
    () => fetchServiceTicket(ticketId, apiAuth),
  )

  const {
    data: customerBundle,
    error: customerError,
    isLoading: customerLoading,
  } = useSWR<CustomerWithProducts>(
    entry === 'customer' ? ['customer-products', cstId, token, username] : null,
    () => fetchCustomerWithProducts(cstId!, apiAuth),
  )

  const customer = customerBundle?.customer
  const products = customerBundle?.products
  const openTickets = customerBundle?.serviceTickets ?? []

  // Default path once customer bundle loads.
  useEffect(() => {
    if (entry !== 'customer' || !customerBundle || customerPath !== null) return
    setCustomerPath(openTickets.length > 0 ? 'choose' : 'create')
  }, [entry, customerBundle, customerPath, openTickets.length])

  const activeTicket: ServiceTicket | null =
    entry === 'url-ticket' ? urlTicket ?? null : selectedExistingTicket

  const isCreate = entry === 'customer' && customerPath === 'create'
  const isExisting = Boolean(activeTicket)
  const isChoosing = entry === 'customer' && customerPath === 'choose'
  const isReschedule = Boolean(activeTicket && isTicketScheduled(activeTicket))
  const currentAppointmentLabel = activeTicket
    ? formatScheduledAppointment(activeTicket)
    : null
  const scheduledOpenTickets = openTickets.filter(isTicketScheduled)
  const hasScheduledOpenTickets = scheduledOpenTickets.length > 0

  const {
    data: blocks,
    error: blocksError,
    isLoading: blocksLoading,
    isValidating: blocksValidating,
  } = useSWR<TimeBlock[]>(
    canSchedule && cstId && token
      ? ['time-blocks', dateRange.startDate, dateRange.endDate, cstId, token, username]
      : null,
    () =>
      fetchTimeBlocks({
        ...dateRange,
        cstId: cstId!,
        ...apiAuth,
      }),
  )

  const [notes, setNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<ScheduleConfirmation | null>(null)
  const [createdContact, setCreatedContact] = useState<ContactInfo | null>(null)

  const [sopAnswers, setSopAnswers] = useState<SopAnswers>({})
  const [sopStatus, setSopStatus] = useState<SopStatus>('pending')
  const [escalateMatt, setEscalateMatt] = useState(false)

  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  // Prefill notes/SOP when an existing ticket becomes active.
  useEffect(() => {
    if (!activeTicket || notesInitialized) return
    const ticketNotes = activeTicket.notes ?? ''
    setNotes(ticketNotes)
    setNotesInitialized(true)

    const parsed = parseSopNotes(ticketNotes)
    if (parsed) {
      setSopAnswers(parsed.answers)
      const branch = resolveSopBranch(activeTicket.productid)
      setSopStatus(isSopComplete(branch, parsed.answers) ? 'complete' : 'pending')
    }
  }, [activeTicket, notesInitialized])

  const productLabel = useMemo(() => {
    if (isCreate) {
      return products?.find((p) => p.id === selectedProductId)?.label ?? null
    }
    return activeTicket?.productid ?? null
  }, [isCreate, products, selectedProductId, activeTicket])

  const sopBranch = resolveSopBranch(productLabel)
  const scheduleConstraints = useMemo(
    () => getSchedulingConstraints(sopBranch, sopAnswers),
    [sopBranch, sopAnswers],
  )

  const enforceSopRules = sopStatus === 'complete'
  const effectiveMinDate = enforceSopRules ? scheduleConstraints.minDate : undefined
  const homeOk =
    !enforceSopRules ||
    !scheduleConstraints.requireHomeConfirmed ||
    sopAnswers.homeConfirmed === true
  const materialScriptOk =
    !enforceSopRules ||
    !(sopBranch === 'siding' && sopAnswers.reusable === false) ||
    sopAnswers.materialScriptExplained === true
  const orderProducts = sopAnswers.reusable === false

  useEffect(() => {
    if (!selectedBlock) return
    if (!isDateSelectable(selectedBlock.date, effectiveMinDate)) {
      setSelectedBlock(null)
    }
  }, [selectedBlock, effectiveMinDate])

  const contact: ContactInfo | null = useMemo(() => {
    if (activeTicket) {
      return {
        firstname: activeTicket.firstname,
        lastname: activeTicket.lastname,
        address1: activeTicket.address1,
        city: activeTicket.city,
        state: activeTicket.state,
        zip: activeTicket.zip,
        phone: activeTicket.phone,
        email: activeTicket.email,
        productLabel: activeTicket.productid,
        status: activeTicket.status,
        scheduledLabel: formatScheduledAppointment(activeTicket) ?? undefined,
      }
    }
    if (isCreate && customer) {
      return {
        firstname: customer.firstname,
        lastname: customer.lastname,
        address1: customer.address1,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        phone: customer.phone,
        email: customer.email,
        productLabel: productLabel ?? undefined,
      }
    }
    if (isChoosing && customer) {
      return {
        firstname: customer.firstname,
        lastname: customer.lastname,
        address1: customer.address1,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        phone: customer.phone,
        email: customer.email,
      }
    }
    return null
  }, [activeTicket, isCreate, isChoosing, customer, productLabel])

  // Non-schedulers skip warranty intake and use the notes field only.
  const sopReady = !canSchedule || sopStatus === 'complete' || sopStatus === 'skipped'

  const createReady = Boolean(selectedProductId && notes.trim() && sopReady && materialScriptOk)
  const scheduleReady = Boolean(
    selectedBlock &&
      notes.trim() &&
      homeOk &&
      materialScriptOk &&
      isDateSelectable(selectedBlock.date, effectiveMinDate) &&
      sopReady,
  )

  const infoLoading =
    entry === 'url-ticket'
      ? ticketLoading || !urlTicket
      : customerLoading || !customerBundle || customerPath === null

  function resetIntakeState() {
    setNotes('')
    setNotesInitialized(false)
    setSelectedProductId('')
    setSelectedBlock(null)
    setSubmitError(null)
    setSopAnswers({})
    setSopStatus('pending')
    setEscalateMatt(false)
    setNotesSaved(false)
    setNotesError(null)
  }

  function handleSelectExistingTicket(ticket: ServiceTicket) {
    resetIntakeState()
    setSelectedExistingTicket(ticket)
    setCustomerPath('existing')
  }

  function handleCreateNewPath() {
    resetIntakeState()
    setSelectedExistingTicket(null)
    setCustomerPath('create')
  }

  function handleBackToChooser() {
    resetIntakeState()
    setSelectedExistingTicket(null)
    setCustomerPath('choose')
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId)
    setSopAnswers((prev) => {
      const issue = prev.issue
      return issue !== undefined && issue !== null ? { issue } : {}
    })
    setSopStatus('pending')
    setSelectedBlock(null)
    if (isCreate) setNotes('')
  }

  function handleSopComplete(composedNotes: string) {
    setNotes(composedNotes)
    setNotesSaved(false)
    setSopStatus('complete')
  }

  function handleSopSkip() {
    const confirmed = window.confirm(
      'Skip the warranty intake? Notes may be incomplete for the service tech.',
    )
    if (!confirmed) return
    setSopStatus('skipped')
  }

  function handleSopRestart() {
    const parsed = parseSopNotes(notes)
    if (parsed) {
      setSopAnswers(parsed.answers)
    }
    setSopStatus('pending')
  }

  function notesPayload(): string {
    // Recompose when intake was edited but not re-applied yet.
    // If status is complete/skipped, prefer the notes field (allows manual edits).
    if (
      productLabel &&
      sopStatus === 'pending' &&
      isSopComplete(sopBranch, sopAnswers)
    ) {
      return composeSopNotes({
        productLabel,
        branch: sopBranch,
        answers: sopAnswers,
        agent: username,
      })
    }
    return notes.trim()
  }

  async function handleScheduleExisting() {
    if (!activeTicket || !scheduleReady) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const notesToSend = notesPayload()
      setNotes(notesToSend)
      const result = await postSchedule({
        ticketId: activeTicket.ticketId,
        block: selectedBlock!,
        notes: notesToSend,
        escalateMatt,
        reschedule: isTicketScheduled(activeTicket),
        orderProducts,
        ...apiAuth,
      })
      setConfirmation(result)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateTicket() {
    if (!cstId || !createReady) return
    if (selectedBlock && !scheduleReady) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const notesToSend = notesPayload()
      setNotes(notesToSend)
      const result: CreateTicketResult = await postCreateTicket({
        cst_id: cstId,
        productId: selectedProductId,
        notes: notesToSend,
        block: selectedBlock ?? undefined,
        ...apiAuth,
      })
      setCreatedContact(contact)
      setConfirmation({
        confirmationNumber: result.confirmationNumber,
        ticketId: result.ticketId,
        block: result.block,
        scheduledAt: result.scheduledAt,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveNotes() {
    if (!activeTicket) return
    setSavingNotes(true)
    setNotesError(null)
    try {
      const notesToSend = notesPayload()
      setNotes(notesToSend)
      // Same schedule endpoint — notes only, no day/time block.
      await postSchedule({
        ticketId: activeTicket.ticketId,
        notes: notesToSend,
        ...apiAuth,
      })
      setNotesSaved(true)
      if (productLabel && isSopComplete(sopBranch, sopAnswers) && sopStatus !== 'skipped') {
        setSopStatus('complete')
      }
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSavingNotes(false)
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesSaved(false)
  }

  function reset() {
    setConfirmation(null)
    setCreatedContact(null)
    setSelectedBlock(null)
    setSubmitError(null)
    setSopAnswers({})
    setSopStatus('pending')
    setEscalateMatt(false)
    setNotesInitialized(false)
    if (isExisting && activeTicket) {
      setNotes(activeTicket.notes ?? '')
      setNotesInitialized(false) // allow effect to re-apply parse
    } else if (isCreate) {
      setNotes('')
      setSelectedProductId('')
    }
  }

  if (entry === 'invalid') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="flex items-start gap-3 rounded-lg border border-avail-red/40 bg-avail-red/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-avail-red" />
          <div>
            <p className="text-sm font-medium text-foreground">Missing required parameters</p>
            <p className="text-sm text-muted-foreground">
              <code className="font-mono text-xs">cst_id</code> and{' '}
              <code className="font-mono text-xs">token</code> are required for all flows.
              Add <code className="font-mono text-xs">ticketId</code> to jump straight to an
              existing ticket, or omit it to load the customer and choose.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (confirmation && (contact || createdContact)) {
    const confContact = createdContact ?? contact!
    const scheduled = Boolean(confirmation.block)
    return (
      <ConfirmationView
        confirmation={confirmation}
        contact={confContact}
        onDone={reset}
        title={
          isCreate
            ? scheduled
              ? 'Ticket Created & Scheduled'
              : 'Service Ticket Created'
            : isReschedule
              ? 'Appointment Rescheduled'
              : 'Appointment Scheduled'
        }
        subtitle={
          isCreate
            ? scheduled
              ? `Ticket ${confirmation.ticketId} was created and scheduled.`
              : `Ticket ${confirmation.ticketId} was created.`
            : isReschedule
              ? `Ticket ${confirmation.ticketId} has been rescheduled.`
              : `A confirmation has been recorded for ticket ${confirmation.ticketId}.`
        }
      />
    )
  }

  const loadError = ticketError || customerError || blocksError

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Service Dispatch
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground text-balance">
          {isChoosing
            ? hasScheduledOpenTickets
              ? 'Customer Has a Scheduled Appointment'
              : 'Customer Service Options'
            : isCreate
              ? 'Create Service Ticket'
              : isReschedule
                ? 'Reschedule Service Appointment'
                : 'Schedule Service Appointment'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          {isChoosing
            ? hasScheduledOpenTickets
              ? 'Stop — review the scheduled ticket(s) below before creating anything new.'
              : 'Select an open service ticket to schedule, or create a new one.'
            : isCreate
              ? canSchedule
                ? 'Capture the issue, confirm the product, complete intake, then create or schedule.'
                : 'Confirm the product, enter notes, then create the service ticket.'
              : isReschedule
                ? 'This ticket is already scheduled. Update notes if needed, then pick a new time block to reschedule.'
                : canSchedule
                  ? 'Review the ticket, complete warranty intake (or skip), then update notes and schedule.'
                  : 'Review the ticket and update notes as needed.'}
        </p>
        {entry === 'customer' && customerPath !== 'choose' && openTickets.length > 0 ? (
          <button
            type="button"
            onClick={handleBackToChooser}
            className="mt-3 text-sm text-primary underline-offset-2 hover:underline"
          >
            ← Back to ticket options
          </button>
        ) : null}
      </header>

      {isChoosing && hasScheduledOpenTickets && !infoLoading ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border-2 border-avail-yellow bg-avail-yellow-muted px-5 py-4 text-avail-yellow-emphasis"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-6 shrink-0" />
            <div>
              <p className="text-lg font-bold uppercase tracking-wide">
                Existing appointment on file
              </p>
              <p className="mt-1 text-sm font-medium opacity-95">
                {scheduledOpenTickets.length === 1
                  ? 'This customer already has a warranty visit scheduled. Confirm whether you should reschedule that ticket before opening a new one.'
                  : `This customer already has ${scheduledOpenTickets.length} warranty visits scheduled. Confirm whether you should reschedule one of those tickets before opening a new one.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isReschedule && currentAppointmentLabel && !isChoosing && !confirmation ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border-2 border-avail-yellow bg-avail-yellow-muted px-5 py-4 text-avail-yellow-emphasis"
        >
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-6 shrink-0" />
            <div>
              <p className="text-lg font-bold uppercase tracking-wide">
                Ticket already scheduled
              </p>
              <p className="mt-1 text-base font-bold">{currentAppointmentLabel}</p>
              <p className="mt-1 text-sm font-medium opacity-90">
                Selecting a new time below will reschedule this appointment.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isCreate && hasScheduledOpenTickets && !confirmation ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border-2 border-avail-yellow bg-avail-yellow-muted px-5 py-4 text-avail-yellow-emphasis"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-6 shrink-0" />
            <div>
              <p className="text-lg font-bold uppercase tracking-wide">
                Creating a new ticket while one is already scheduled
              </p>
              <p className="mt-1 text-sm font-medium opacity-95">
                This customer already has{' '}
                {scheduledOpenTickets.length === 1
                  ? 'a scheduled warranty appointment'
                  : `${scheduledOpenTickets.length} scheduled warranty appointments`}
                . Only continue if this is a separate issue — otherwise go back and reschedule the
                existing ticket.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="flex items-start gap-3 rounded-lg border border-avail-red/40 bg-avail-red/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-avail-red" />
          <div>
            <p className="text-sm font-medium text-foreground">Failed to load data</p>
            <p className="text-sm text-muted-foreground">
              Check the API connection and refresh the page.
              {loadError.message}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            {infoLoading || !contact ? (
              <ServiceInfoSkeleton />
            ) : (
              <ServiceInfo contact={contact} />
            )}
          </div>

          {isChoosing && !infoLoading ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <ExistingTicketPicker
                tickets={openTickets}
                onSelectTicket={handleSelectExistingTicket}
                onCreateNew={handleCreateNewPath}
              />
            </div>
          ) : null}

          {!infoLoading && !isChoosing && canSchedule && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <SopWizard
                productLabel={productLabel}
                answers={sopAnswers}
                onAnswersChange={setSopAnswers}
                status={sopStatus}
                onComplete={handleSopComplete}
                onSkip={handleSopSkip}
                onRestart={handleSopRestart}
                agent={username}
                productSlot={
                  isCreate ? (
                    !products ? (
                      <ProductSelectSkeleton />
                    ) : (
                      <ProductSelect
                        products={products}
                        value={selectedProductId}
                        onChange={handleProductChange}
                      />
                    )
                  ) : undefined
                }
              />
            </div>
          )}

          {!isChoosing && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              {isCreate && !canSchedule && !infoLoading ? (
                <div className="mb-5">
                  {!products ? (
                    <ProductSelectSkeleton />
                  ) : (
                    <ProductSelect
                      products={products}
                      value={selectedProductId}
                      onChange={handleProductChange}
                    />
                  )}
                </div>
              ) : null}

              {infoLoading ? (
                <NotesFieldSkeleton />
              ) : (
                <NotesField
                  value={notes}
                  onChange={handleNotesChange}
                  required={isCreate}
                  hint={
                    canSchedule && sopStatus === 'complete'
                      ? 'Generated from warranty intake — editable'
                      : canSchedule && isCreate
                        ? 'Complete or skip intake, then confirm notes'
                        : isCreate
                          ? 'Describe the issue for the service tech'
                          : 'Pre-filled from ticket'
                  }
                />
              )}

              {isExisting && (
                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {notesSaved ? (
                      <span className="flex items-center gap-1.5 text-avail-green">
                        <Check className="size-4" />
                        Notes saved.
                      </span>
                    ) : canSchedule ? (
                      'Save notes anytime — scheduling is optional.'
                    ) : (
                      'Make your changes, then save the notes.'
                    )}
                  </p>
                  <Button
                    variant={canSchedule ? 'outline' : 'default'}
                    onClick={handleSaveNotes}
                    disabled={!activeTicket || savingNotes || notesSaved || !notes.trim()}
                    className="sm:w-auto"
                  >
                    {savingNotes && <Loader2 className="size-4 animate-spin" />}
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </Button>
                </div>
              )}

              {isExisting && notesError && (
                <p className="mt-3 flex items-center gap-2 text-sm text-avail-red" role="alert">
                  <AlertCircle className="size-4" />
                  {notesError}
                </p>
              )}

              {isCreate && !canSchedule && (
                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground" aria-live="polite">
                    {createReady
                      ? 'Ready to create the service ticket.'
                      : 'Select a product and enter notes to continue.'}
                  </p>
                  <Button
                    onClick={handleCreateTicket}
                    disabled={!createReady || submitting}
                    className="sm:w-auto"
                  >
                    {submitting && <Loader2 className="size-4 animate-spin" />}
                    {submitting ? 'Creating…' : 'Create Ticket'}
                  </Button>
                </div>
              )}

              {isCreate && !canSchedule && submitError && (
                <p className="mt-3 flex items-center gap-2 text-sm text-avail-red" role="alert">
                  <AlertCircle className="size-4" />
                  {submitError}
                </p>
              )}
            </div>
          )}

          {!isChoosing && canSchedule ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              {isReschedule && currentAppointmentLabel ? (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Already scheduled — reschedule below</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Current appointment: {currentAppointmentLabel}
                    </p>
                  </div>
                </div>
              ) : null}

              {scheduleConstraints.banners.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {scheduleConstraints.banners.map((banner) => (
                    <li
                      key={banner}
                      className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{banner}</span>
                    </li>
                  ))}
                </ul>
              )}

              <TimeBlockPicker
                blocks={blocks ?? []}
                selectedId={selectedBlock?.id ?? null}
                onSelect={setSelectedBlock}
                weekOffset={weekOffset}
                onWeekOffsetChange={(offset) => {
                  setWeekOffset(offset)
                  setSelectedBlock(null)
                }}
                isLoading={blocksLoading || (blocksValidating && !blocks)}
                minDate={effectiveMinDate}
              />

              {!isCreate ? (
                <label className="mt-5 flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={escalateMatt}
                    onChange={(e) => setEscalateMatt(e.target.checked)}
                    className="mt-0.5 size-4 rounded border-input"
                  />
                  <span>
                    <span className="font-medium">Major pushback on timeframe — escalate to Matt</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Optional. Sent with the schedule request if checked.
                    </span>
                  </span>
                </label>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {isCreate
                    ? !sopReady
                      ? 'Complete or skip warranty intake to continue.'
                      : !homeOk
                        ? 'Confirm the homeowner will be home before scheduling.'
                        : selectedBlock
                          ? 'Time block selected — ticket will be created and scheduled.'
                          : createReady
                            ? 'Optional: select a time block, or create the ticket without scheduling.'
                            : 'Select a product and enter notes to continue.'
                    : !homeOk
                      ? 'Confirm the homeowner will be home before scheduling.'
                      : selectedBlock
                        ? isReschedule
                          ? 'New time block selected — ready to reschedule.'
                          : 'Time block selected — ready to confirm.'
                        : isReschedule
                          ? 'Select a new time block to reschedule.'
                          : 'Select a time block to continue.'}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {isCreate ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleCreateTicket}
                        disabled={!createReady || submitting || Boolean(selectedBlock)}
                        className="sm:w-auto"
                      >
                        {submitting && !selectedBlock && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        Create Ticket
                      </Button>
                      <Button
                        onClick={handleCreateTicket}
                        disabled={!createReady || !scheduleReady || submitting}
                        className="sm:w-auto"
                      >
                        {submitting && selectedBlock && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                        {submitting && selectedBlock ? 'Creating…' : 'Create & Schedule'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleScheduleExisting}
                      disabled={!scheduleReady || submitting}
                      className="sm:w-auto"
                    >
                      {submitting && <Loader2 className="size-4 animate-spin" />}
                      {submitting
                        ? isReschedule
                          ? 'Rescheduling…'
                          : 'Scheduling…'
                        : isReschedule
                          ? 'Reschedule Appointment'
                          : 'Confirm Appointment'}
                    </Button>
                  )}
                </div>
              </div>

              {submitError && (
                <p className="mt-3 flex items-center gap-2 text-sm text-avail-red" role="alert">
                  <AlertCircle className="size-4" />
                  {submitError}
                </p>
              )}
            </div>
          ) : null}

          {!isChoosing && !canSchedule ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-5 py-4">
              <Lock className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Scheduling not available</p>
                <p className="text-sm text-muted-foreground text-pretty">
                  {username
                    ? `The account "${username}" doesn't have scheduling access.${
                        isCreate
                          ? ' You can still create the ticket above.'
                          : ' You can still review and update the notes above.'
                      }`
                    : isCreate
                      ? 'You can create the ticket above. Scheduling requires an authorized account.'
                      : 'You can review and update the notes above. Scheduling requires an authorized account.'}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

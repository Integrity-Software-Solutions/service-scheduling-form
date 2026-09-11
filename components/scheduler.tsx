'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { AlertCircle, Check, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ServiceInfo, ServiceInfoSkeleton } from '@/components/service-info'
import { NotesField, NotesFieldSkeleton } from '@/components/notes-field'
import { ProductSelect, ProductSelectSkeleton } from '@/components/product-select'
import { TimeBlockPicker } from '@/components/time-block-picker'
import { ConfirmationView } from '@/components/confirmation-view'
import { SopWizard } from '@/components/sop-wizard'
import {
  fetchCustomerWithProducts,
  fetchServiceTicket,
  fetchTimeBlocks,
  postCreateTicket,
  postNotes,
  postSchedule,
} from '@/lib/api'
import { canAccessScheduler } from '@/lib/access'
import { weekDateRange } from '@/lib/format'
import {
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

export function Scheduler() {
  const searchParams = useSearchParams()
  const username = searchParams.get('username')
  const ticketId = searchParams.get('ticketId')
  const cstId = searchParams.get('cst_id')
  const canSchedule = canAccessScheduler(username)

  // cst_id is required for scoring on every flow.
  // ticketId + cst_id = schedule existing; cst_id alone = create ticket.
  const mode: 'ticket' | 'create' | 'invalid' = !cstId
    ? 'invalid'
    : ticketId
      ? 'ticket'
      : 'create'

  const [weekOffset, setWeekOffset] = useState(0)
  const dateRange = weekDateRange(weekOffset)

  const {
    data: ticket,
    error: ticketError,
    isLoading: ticketLoading,
  } = useSWR<ServiceTicket>(
    mode === 'ticket' ? ['service-ticket', ticketId] : null,
    () => fetchServiceTicket(ticketId),
  )

  const {
    data: customerBundle,
    error: customerError,
    isLoading: customerLoading,
  } = useSWR<CustomerWithProducts>(
    mode === 'create' ? ['customer-products', cstId] : null,
    () => fetchCustomerWithProducts(cstId!),
  )

  const customer = customerBundle?.customer
  const products = customerBundle?.products

  const {
    data: blocks,
    error: blocksError,
    isLoading: blocksLoading,
    isValidating: blocksValidating,
  } = useSWR<TimeBlock[]>(
    canSchedule && cstId
      ? ['time-blocks', dateRange.startDate, dateRange.endDate, cstId]
      : null,
    () =>
      fetchTimeBlocks({
        ...dateRange,
        cstId: cstId!,
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

  // Notes-only save flow (existing ticket, users without schedule access).
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'ticket' && ticket && !notesInitialized) {
      const ticketNotes = ticket.notes ?? ''
      setNotes(ticketNotes)
      setNotesInitialized(true)

      const parsed = parseSopNotes(ticketNotes)
      if (parsed) {
        setSopAnswers(parsed.answers)
        const branch = resolveSopBranch(ticket.productid)
        setSopStatus(isSopComplete(branch, parsed.answers) ? 'complete' : 'pending')
      }
    }
  }, [mode, ticket, notesInitialized])

  const productLabel = useMemo(() => {
    if (mode === 'create') {
      return products?.find((p) => p.id === selectedProductId)?.label ?? null
    }
    return ticket?.productid ?? null
  }, [mode, products, selectedProductId, ticket])

  const sopBranch = resolveSopBranch(productLabel)
  const scheduleConstraints = useMemo(
    () => getSchedulingConstraints(sopBranch, sopAnswers),
    [sopBranch, sopAnswers],
  )

  // Hard SOP scheduling gates only apply after intake is completed (not when skipped).
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

  // Drop a selected block if SOP rules make it invalid.
  useEffect(() => {
    if (!selectedBlock) return
    if (!isDateSelectable(selectedBlock.date, effectiveMinDate)) {
      setSelectedBlock(null)
    }
  }, [selectedBlock, effectiveMinDate])

  const contact: ContactInfo | null = useMemo(() => {
    if (mode === 'ticket' && ticket) {
      return {
        firstname: ticket.firstname,
        lastname: ticket.lastname,
        address1: ticket.address1,
        city: ticket.city,
        state: ticket.state,
        zip: ticket.zip,
        phone: ticket.phone,
        email: ticket.email,
        productLabel: ticket.productid,
      }
    }
    if (mode === 'create' && customer) {
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
    return null
  }, [mode, ticket, customer, productLabel])

  const sopReady = sopStatus === 'complete' || sopStatus === 'skipped'

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
    mode === 'ticket' ? ticketLoading || !ticket : customerLoading || !customerBundle

  function handleProductChange(productId: string) {
    setSelectedProductId(productId)
    // Keep the free-text issue; reset product-specific follow-ups.
    setSopAnswers((prev) => {
      const issue = prev.issue
      return issue !== undefined && issue !== null ? { issue } : {}
    })
    setSopStatus('pending')
    setSelectedBlock(null)
    if (mode === 'create') setNotes('')
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
    // Prefer restoring from current notes so agents can edit without retyping.
    const parsed = parseSopNotes(notes)
    if (parsed) {
      setSopAnswers(parsed.answers)
    }
    setSopStatus('pending')
  }

  async function handleScheduleExisting() {
    if (!ticket || !scheduleReady) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await postSchedule({
        ticketId: ticket.ticketId,
        block: selectedBlock!,
        notes,
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
      const result: CreateTicketResult = await postCreateTicket({
        cst_id: cstId,
        productId: selectedProductId,
        notes: notes.trim(),
        block: selectedBlock ?? undefined,
        username,
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
    if (!ticket) return
    setSavingNotes(true)
    setNotesError(null)
    try {
      await postNotes({ ticketId: ticket.ticketId, notes })
      setNotesSaved(true)
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
    if (mode === 'ticket' && ticket) {
      setNotes(ticket.notes ?? '')
    } else if (mode === 'create') {
      setNotes('')
      setSelectedProductId('')
    }
  }

  if (mode === 'invalid') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <div className="flex items-start gap-3 rounded-lg border border-avail-red/40 bg-avail-red/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-avail-red" />
          <div>
            <p className="text-sm font-medium text-foreground">Missing required parameters</p>
            <p className="text-sm text-muted-foreground">
              <code className="font-mono text-xs">cst_id</code> is required for all flows.
              Add <code className="font-mono text-xs">ticketId</code> to schedule an existing
              ticket, or omit it to create a new one.
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
          mode === 'create'
            ? scheduled
              ? 'Ticket Created & Scheduled'
              : 'Service Ticket Created'
            : 'Appointment Scheduled'
        }
        subtitle={
          mode === 'create'
            ? scheduled
              ? `Ticket ${confirmation.ticketId} was created and scheduled.`
              : `Ticket ${confirmation.ticketId} was created.`
            : `A confirmation has been recorded for ticket ${confirmation.ticketId}.`
        }
      />
    )
  }

  const loadError = ticketError || customerError || blocksError
  const isCreate = mode === 'create'

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Service Dispatch
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground text-balance">
          {isCreate ? 'Create Service Ticket' : 'Schedule Service Appointment'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          {isCreate
            ? 'Capture the issue, confirm the product, complete intake, then create or schedule.'
            : 'Review the ticket, complete warranty intake (or skip), then update notes and schedule.'}
        </p>
      </header>

      {loadError ? (
        <div className="flex items-start gap-3 rounded-lg border border-avail-red/40 bg-avail-red/10 px-4 py-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-avail-red" />
          <div>
            <p className="text-sm font-medium text-foreground">Failed to load data</p>
            <p className="text-sm text-muted-foreground">
              Check the API connection and refresh the page.
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

          {!infoLoading && (
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

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            {infoLoading ? (
              <NotesFieldSkeleton />
            ) : (
              <NotesField
                value={notes}
                onChange={handleNotesChange}
                required={isCreate}
                hint={
                  sopStatus === 'complete'
                    ? 'Generated from warranty intake — editable'
                    : isCreate
                      ? 'Complete or skip intake, then confirm notes'
                      : 'Pre-filled from ticket'
                }
              />
            )}

            {!isCreate && !canSchedule && (
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {notesSaved ? (
                    <span className="flex items-center gap-1.5 text-avail-green">
                      <Check className="size-4" />
                      Notes saved.
                    </span>
                  ) : (
                    'Make your changes, then save the notes.'
                  )}
                </p>
                <Button
                  onClick={handleSaveNotes}
                  disabled={ticketLoading || !ticket || savingNotes || notesSaved}
                  className="sm:w-auto"
                >
                  {savingNotes && <Loader2 className="size-4 animate-spin" />}
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </Button>
              </div>
            )}

            {!isCreate && !canSchedule && notesError && (
              <p className="mt-3 flex items-center gap-2 text-sm text-avail-red" role="alert">
                <AlertCircle className="size-4" />
                {notesError}
              </p>
            )}

            {isCreate && !canSchedule && (
              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {!sopReady
                    ? 'Complete or skip warranty intake to continue.'
                    : createReady
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

          {canSchedule ? (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
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
                        ? 'Time block selected — ready to confirm.'
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
                      {submitting ? 'Scheduling…' : 'Confirm Appointment'}
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
          ) : (
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
          )}
        </div>
      )}
    </div>
  )
}

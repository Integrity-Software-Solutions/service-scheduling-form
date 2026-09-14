import {
  buildMockAvailabilityDays,
  buildMockConfirmation,
  buildMockCreateTicketResult,
  buildMockCustomerWithProducts,
  MOCK_TICKET,
  withMockLatency,
} from '@/lib/mocks'
import type {
  AvailabilityDay,
  AvailabilityFlag,
  AvailabilityScore,
  CreateTicketPayload,
  CreateTicketResult,
  Customer,
  CustomerProductsResponse,
  CustomerWithProducts,
  ProductOption,
  ScheduleConfirmation,
  ServiceTicket,
  TimeBlock,
} from '@/lib/types'

/**
 * API base paths for the PHP-FPM backend.
 * Set NEXT_PUBLIC_USE_MOCKS=false and point these at real PHP endpoints
 * when wiring the live CRM / scheduling APIs.
 */
export const API = {
  ticket: process.env.NEXT_PUBLIC_API_TICKET ?? '/api/service-ticket.php',
  // Returns { customer, products } for the create-ticket flow.
  customerProducts:
    process.env.NEXT_PUBLIC_API_CUSTOMER ??
    process.env.NEXT_PUBLIC_API_PRODUCTS ??
    '/api/customer-products.php',
  createTicket: process.env.NEXT_PUBLIC_API_SCHEDULE ?? '/api/create-ticket.php',
  blocks: process.env.NEXT_PUBLIC_API_BLOCKS ?? '/api/time-blocks.php',
  schedule: process.env.NEXT_PUBLIC_API_SCHEDULE ?? '/api/schedule.php',
} as const

/**
 * Defaults to mock until PHP endpoints are deployed.
 * Set NEXT_PUBLIC_USE_MOCKS=false when pointing at live PHP-FPM APIs.
 */
export function useMocks(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_MOCKS
  if (flag === 'false' || flag === '0') return false
  return true
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json() as Promise<T>
}

function originBase(): string {
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
}

export async function fetchServiceTicket(ticketId?: string | null): Promise<ServiceTicket> {
  if (useMocks()) {
    return withMockLatency(MOCK_TICKET, 400)
  }

  const url = new URL(API.ticket, originBase())
  if (ticketId) {
    url.searchParams.set(
      'rptSQL',
      'SELECT *, jsv_JobService.id as ticketId, Notes as notes FROM jsv_JobService LEFT JOIN ProspectJobs ON jsv_JobService.job_id = ProspectJobs.id WHERE jsv_JobService.id = ' +
        ticketId,
    )
  }

  // customReport.php returns a row array; the ticket is the first record.
  const rows = await parseJson<ServiceTicket[]>(await fetch(url.toString()))
  const ticket = rows[0]
  if (!ticket) {
    throw new Error(ticketId ? `No service ticket found for id ${ticketId}.` : 'No service ticket found.')
  }
  return ticket
}

function mapCustomerProductsResponse(data: CustomerProductsResponse): CustomerWithProducts {
  if (!data?.customer) {
    throw new Error('Customer data missing from products response.')
  }

  const customer: Customer = {
    cst_id: String(data.customer.cst_id),
    firstname: data.customer.firstname,
    lastname: data.customer.lastname,
    address1: data.customer.address1,
    city: data.customer.city,
    state: data.customer.state,
    zip: data.customer.zip,
    phone: data.customer.phone,
    email: data.customer.email,
  }

  const products: ProductOption[] = (data.products ?? []).map((product) => ({
    id: String(product.id),
    label: product.productid,
  }))

  const productByJobId = new Map(
    (data.products ?? []).map((product) => [String(product.id), product.productid]),
  )

  const serviceTickets: ServiceTicket[] = (data.services ?? [])
    .filter((row) => {
      const unscheduled = row.SchedSvcDate == null || String(row.SchedSvcDate).trim() === ''
      const incomplete = row.CompleteDate == null || String(row.CompleteDate).trim() === ''
      return unscheduled && incomplete
    })
    .map((row) => ({
      ticketId: String(row.id),
      productid: productByJobId.get(String(row.job_id)) ?? 'Unknown',
      firstname: customer.firstname,
      lastname: customer.lastname,
      address1: customer.address1,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
      phone: customer.phone,
      email: customer.email,
      notes: row.Notes ?? '',
    }))

  return { customer, products, serviceTickets }
}

/** Loads customer + warranty products from the combined endpoint. */
export async function fetchCustomerWithProducts(cstId: string): Promise<CustomerWithProducts> {
  const hasLiveEndpoint = Boolean(
    process.env.NEXT_PUBLIC_API_CUSTOMER || process.env.NEXT_PUBLIC_API_PRODUCTS,
  )

  if (useMocks() || !hasLiveEndpoint) {
    return withMockLatency(buildMockCustomerWithProducts(cstId), 400)
  }

  const url = new URL(API.customerProducts, originBase())
  url.searchParams.set('cst_id', cstId)
  const data = await parseJson<CustomerProductsResponse>(await fetch(url.toString()))
  return mapCustomerProductsResponse(data)
}

export async function postCreateTicket(payload: CreateTicketPayload): Promise<CreateTicketResult> {
  if (!payload.notes.trim()) {
    throw new Error('Notes are required.')
  }
  if (!payload.productId) {
    throw new Error('A product is required.')
  }

  if (useMocks() || !process.env.NEXT_PUBLIC_API_SCHEDULE ) {
    return withMockLatency(buildMockCreateTicketResult(payload), 600)
  }

  return parseJson<CreateTicketResult>(
    await fetch(API.createTicket, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  )
}

export type TimeBlockDateRange = {
  startDate: string // ISO date, e.g. "2026-09-14"
  endDate: string
  /** Required for availability scoring on every flow. */
  cstId: string
}

const SCORE_TO_FLAG: Record<AvailabilityScore, AvailabilityFlag> = {
  1: 'green',
  2: 'yellow',
  3: 'red',
}

export function scoreToFlag(score: number): AvailabilityFlag {
  return SCORE_TO_FLAG[score as AvailabilityScore] ?? 'red'
}

/** Flatten API day/slot payload into UI TimeBlock rows. */
export function mapAvailabilityDaysToTimeBlocks(days: AvailabilityDay[]): TimeBlock[] {
  return days.flatMap((day) =>
    (day.slots ?? []).map((slot, index) => ({
      id: `${day.date}-${slot.start}-${slot.end}-${index}`,
      date: day.date,
      startTime: slot.start,
      endTime: slot.end,
      flag: scoreToFlag(slot.score),
    })),
  )
}

export async function fetchTimeBlocks(range: TimeBlockDateRange): Promise<TimeBlock[]> {
  if (!range.cstId) {
    throw new Error('cst_id is required for availability scoring.')
  }

  if (useMocks()) {
    return withMockLatency(mapAvailabilityDaysToTimeBlocks(buildMockAvailabilityDays(range)), 500)
  }

  const url = new URL(API.blocks, originBase())
  url.searchParams.set('start', range.startDate)
  url.searchParams.set('end', range.endDate)
  url.searchParams.set('cst_id', range.cstId)

  const days = await parseJson<AvailabilityDay[]>(await fetch(url.toString()))
  return mapAvailabilityDaysToTimeBlocks(days)
}

export async function postSchedule(payload: {
  ticketId: string
  notes: string
  block?: TimeBlock
}): Promise<ScheduleConfirmation> {
  if (useMocks()) {
    return withMockLatency(buildMockConfirmation(payload.ticketId, payload.block), 600)
  }

  // Backend service rows use `Notes`; send both casings for compatibility.
  const body: Record<string, unknown> = {
    ticketId: payload.ticketId,
    notes: payload.notes,
    Notes: payload.notes,
  }
  if (payload.block) {
    body.block = payload.block
  }

  return parseJson<ScheduleConfirmation>(
    await fetch(API.schedule, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

import type {
  AvailabilityDay,
  AvailabilityScore,
  CreateTicketPayload,
  CreateTicketResult,
  Customer,
  CustomerWithProducts,
  ProductOption,
  ScheduleConfirmation,
  ServiceTicket,
  TimeBlock,
} from '@/lib/types'

export const MOCK_TICKET: ServiceTicket = {
  ticketId: '12345',
  productid: 'Gutters',
  firstname: 'Marcus',
  lastname: 'Whitfield',
  address1: '1847 Cedar Hollow Ln',
  city: 'Asheville',
  state: 'NC',
  zip: '28801',
  phone: '(828) 555-0142',
  email: 'm.whitfield@example.com',
  notes:
    'Customer reports the upstairs unit stopped cooling two days ago. Outdoor condenser fan is running but no cold air from vents. Homeowner has a dog on-site — please call 15 minutes before arrival. Gate code is 4471.',
}

export const MOCK_CUSTOMER: Customer = {
  cst_id: '1004',
  firstname: 'AAA',
  lastname: 'Customer',
  address1: '4759 Monac drive',
  city: 'toledo',
  state: 'OH',
  zip: '48230',
  phone: '4192602266',
  email: 'test@test.com',
}

export const MOCK_PRODUCTS: ProductOption[] = [
  { id: '1004', label: 'Windows' },
  { id: '22847', label: 'Roof (Res)' },
  { id: '27367', label: 'Gutters' },
]

const SLOTS = [
  { start: '08:00', end: '10:00' },
  { start: '10:00', end: '12:00' },
  { start: '12:00', end: '14:00' },
  { start: '14:00', end: '16:00' },
  { start: '16:00', end: '18:00' },
]

const SCORES: AvailabilityScore[] = [1, 2, 3]

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Mock payload matching the live time-blocks endpoint shape. */
export function buildMockAvailabilityDays(range?: {
  startDate: string
  endDate: string
}): AvailabilityDay[] {
  const days: AvailabilityDay[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = range ? new Date(`${range.startDate}T00:00:00`) : today
  const end = range
    ? new Date(`${range.endDate}T00:00:00`)
    : (() => {
        const d = new Date(today)
        d.setDate(d.getDate() + 27)
        return d
      })()

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const iso = toISODate(cursor)
    const weekday = cursor.getDay()
    const dayOffset = Math.round((cursor.getTime() - today.getTime()) / 86_400_000)

    // Empty slots on Sundays to mirror sparse live responses.
    if (weekday === 0) {
      days.push({ date: iso, slots: [] })
      continue
    }

    days.push({
      date: iso,
      slots: SLOTS.map((slot, i) => ({
        ...slot,
        score: SCORES[(Math.max(0, dayOffset) * 3 + i * 2) % 3],
      })),
    })
  }

  return days
}

export function buildMockCustomer(cstId: string): Customer {
  return { ...MOCK_CUSTOMER, cst_id: cstId || MOCK_CUSTOMER.cst_id }
}

export function buildMockCustomerWithProducts(cstId: string): CustomerWithProducts {
  const customer = buildMockCustomer(cstId)
  return {
    customer,
    products: MOCK_PRODUCTS.map((p) => ({ ...p })),
    serviceTickets: [
      {
        ticketId: '16408',
        productid: 'Gutters',
        status: 'Open',
        firstname: customer.firstname,
        lastname: customer.lastname,
        address1: customer.address1,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        phone: customer.phone,
        email: customer.email,
        notes: 'HO is complaining about something',
      },
    ],
  }
}

export function buildMockCreateTicketResult(payload: CreateTicketPayload): CreateTicketResult {
  return {
    ticketId: `SVC-${Math.floor(10000 + Math.random() * 90000)}`,
    confirmationNumber: `CNF-${Math.floor(100000 + Math.random() * 900000)}`,
    block: payload.block,
    scheduledAt: new Date().toISOString(),
  }
}

export function buildMockConfirmation(
  ticketId: string,
  block?: TimeBlock,
): ScheduleConfirmation {
  return {
    confirmationNumber: `CNF-${Math.floor(100000 + Math.random() * 900000)}`,
    ticketId,
    block,
    scheduledAt: new Date().toISOString(),
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Simulate network latency in mock mode so loading states stay visible. */
export async function withMockLatency<T>(value: T, ms = 400): Promise<T> {
  await delay(ms)
  return value
}

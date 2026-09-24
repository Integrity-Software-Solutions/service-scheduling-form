export type AvailabilityFlag = 'green' | 'yellow' | 'red' | 'blocked'

/** Availability score from the scheduling API: 1 = green, 2 = yellow, 3 = red, 4 = blocked */
export type AvailabilityScore = 1 | 2 | 3 | 4

export interface ServiceTicket {
  ticketId: string
  productid: string
  /** Display status from the services array (e.g. Open, Scheduled). */
  status?: string
  /**
   * Scheduled service date from `SchedSvcDate`.
   * Non-empty means the ticket already has an appointment (reschedule flow).
   */
  schedSvcDate?: string
  /** Optional window start (HH:mm) when the backend provides it. */
  schedStartTime?: string
  /** Optional window end (HH:mm) when the backend provides it. */
  schedEndTime?: string
  firstname: string
  lastname: string
  address1: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  notes: string
}

/** Customer record used when creating a new service ticket (cst_id flow). */
export interface Customer {
  cst_id: string
  firstname: string
  lastname: string
  address1: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
}

/** Raw product row from getWarrantyProducts (and similar) endpoints. */
export interface WarrantyProduct {
  id: number | string
  productid: string
  ActCompleteDate?: string
  NumMonths?: number | string
  cst_id?: number | string
  firstname?: string
  lastname?: string
  address1?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  email?: string
}

/** Combined customer + products payload from the warranty products endpoint. */
export interface CustomerProductsResponse {
  customer: {
    cst_id: number | string
    firstname: string
    lastname: string
    address1: string
    city: string
    state: string
    zip: string
    phone: string
    email: string
  }
  products: WarrantyProduct[]
  /** Open / existing job-service rows (jsv_JobService). */
  services?: RawServiceRow[]
}

/** Raw service ticket row from the customer products endpoint. */
export interface RawServiceRow {
  id: number | string
  job_id: number | string
  cst_id?: number | string
  Notes?: string | null
  status?: string | null
  SchedSvcDate?: string | null
  /** Optional time window fields when returned by the backend. */
  startTime?: string | null
  endTime?: string | null
  StartTime?: string | null
  EndTime?: string | null
  CompleteDate?: string | null
  EnteredOnDate?: string | null
  Descr?: string | null
  [key: string]: unknown
}

export interface ProductOption {
  id: string
  label: string
}

export interface CustomerWithProducts {
  customer: Customer
  products: ProductOption[]
  /** Existing service tickets from the customer products endpoint (server-filtered). */
  serviceTickets: ServiceTicket[]
}

/** Shared contact fields shown in ServiceInfo for ticket or create flows. */
export interface ContactInfo {
  firstname: string
  lastname: string
  address1: string
  city: string
  state: string
  zip: string
  phone: string
  email: string
  productLabel?: string
  status?: string
  /** Human-readable current appointment when already scheduled. */
  scheduledLabel?: string
}

/** Raw slot shape returned by the time-blocks endpoint. */
export interface AvailabilitySlot {
  start: string // "08:00"
  end: string // "10:00"
  score: AvailabilityScore | number
}

/** Raw day shape returned by the time-blocks endpoint. */
export interface AvailabilityDay {
  date: string // ISO date, e.g. "2026-09-14"
  slots: AvailabilitySlot[]
}

export interface TimeBlock {
  id: string
  date: string // ISO date, e.g. "2026-09-14"
  startTime: string // "08:00"
  endTime: string // "10:00"
  /**
   * Availability grade from the scheduling API.
   * green   = wide open, best choice
   * yellow  = limited capacity
   * red     = nearly full / not recommended
   * blocked = almost always a no-go (hollow dashed chip)
   */
  flag: AvailabilityFlag
}

export interface ScheduleConfirmation {
  confirmationNumber: string
  ticketId: string
  block?: TimeBlock
  scheduledAt: string
}

/** Auth fields forwarded from the form URL to every PHP endpoint. */
export interface ApiAuth {
  token?: string | null
  username?: string | null
}

export interface CreateTicketPayload extends ApiAuth {
  cst_id: string
  productId: string
  notes: string
  block?: TimeBlock
  /** Product cannot be re-used — materials need to be ordered (triggers backend email). */
  orderProducts?: boolean
}

export interface CreateTicketResult {
  ticketId: string
  confirmationNumber: string
  block?: TimeBlock
  scheduledAt: string
}

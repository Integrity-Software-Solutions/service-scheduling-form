import { MapPin, Phone, Mail, User, Wrench } from 'lucide-react'
import type { ContactInfo } from '@/lib/types'

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground text-pretty">{value}</dd>
      </div>
    </div>
  )
}

export function ServiceInfo({
  contact,
  productSlot,
}: {
  contact: ContactInfo
  /** When set (create flow), replaces the read-only Product row. */
  productSlot?: React.ReactNode
}) {
  const address = `${contact.address1}, ${contact.city}, ${contact.state} ${contact.zip}`

  return (
    <section aria-labelledby="service-info-heading">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="service-info-heading" className="text-sm font-semibold text-foreground">
          Service Information
        </h2>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 sm:gap-x-8">
        {productSlot ? (
          <div className="sm:col-span-2 py-3">{productSlot}</div>
        ) : contact.productLabel ? (
          <Row
            icon={Wrench}
            label="Product"
            value={
              contact.status
                ? `${contact.productLabel} · ${contact.status}`
                : contact.productLabel
            }
          />
        ) : null}
        <Row icon={User} label="Homeowner" value={`${contact.firstname} ${contact.lastname}`} />
        <Row icon={MapPin} label="Address" value={address} />
        <Row icon={Phone} label="Phone" value={contact.phone} />
        <Row icon={Mail} label="Email" value={contact.email} />
      </dl>
    </section>
  )
}

export function ServiceInfoSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-x-6 pt-2 sm:grid-cols-2 sm:gap-x-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3">
            <div className="size-4 animate-pulse rounded bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

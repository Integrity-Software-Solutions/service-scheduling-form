'use client'

import type { ProductOption } from '@/lib/types'

export function ProductSelect({
  products,
  value,
  onChange,
  disabled,
}: {
  products: ProductOption[]
  value: string
  onChange: (productId: string) => void
  disabled?: boolean
}) {
  return (
    <div className="min-w-0">
      <label htmlFor="product-select" className="text-xs uppercase tracking-wide text-muted-foreground">
        Product <span className="text-avail-red">*</span>
      </label>
      <select
        id="product-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        className="mt-1.5 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Select a product…</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ProductSelectSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  )
}

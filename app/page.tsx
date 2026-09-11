import { Suspense } from 'react'
import { Scheduler } from '@/components/scheduler'

export default function Page() {
  return (
    <main className="min-h-svh bg-background">
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="h-8 w-64 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          </div>
        }
      >
        <Scheduler />
      </Suspense>
    </main>
  )
}

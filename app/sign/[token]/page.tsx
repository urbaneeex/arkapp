import { Suspense } from 'react'
import SignPageClient from './SignPageClient'

export const dynamic = 'force-dynamic'

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <SignPageClient token={token} />
    </Suspense>
  )
}

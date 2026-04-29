import { getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import ClientForm from '@/app/(dashboard)/dashboard/clients/clientForm'
import { getBusinessForUser } from '@/lib/supabase/business'

export default async function NewClientPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) redirect('/dashboard')

  const country =
    typeof businessResult.business.country === 'string'
      ? businessResult.business.country
      : 'ES'

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo cliente" />
      <ClientForm defaultCountry={country} />
    </div>
  )
}
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import ClientForm from '@/app/(dashboard)/dashboard/clients/clientForm'
import { getBusinessIdForUser } from '@/lib/supabase/business'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) redirect('/dashboard')

  const { data: business } = await supabase
    .from('businesses')
    .select('country')
    .eq('id', businessId)
    .single()

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo cliente" />
      <ClientForm defaultCountry={business?.country ?? 'ES'} />
    </div>
  )
}
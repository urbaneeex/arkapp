import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { ServiceForm } from '@/components/services/ServiceForm'

export default async function NewServicePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', user.id)
    .single()

  if (!business) redirect('/dashboard')

  return (
    <div className="max-w-xl">
      <PageHeader title="Nuevo servicio" />
      <ServiceForm businessId={business.id} />
    </div>
  )
}

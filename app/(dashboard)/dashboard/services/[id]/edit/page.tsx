import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { ServiceForm } from '@/components/services/ServiceForm'

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (error || !service) notFound()

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar servicio" />
      <ServiceForm businessId={business.id} service={service} />
    </div>
  )
}

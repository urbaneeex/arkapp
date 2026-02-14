import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import ClientForm from '../../clientForm'

export default async function EditClientPage({
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

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (error || !client) notFound()

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Editar cliente</h1>
      <p className="text-gray-600 mb-8">{client.name}</p>
      <ClientForm client={client} />
    </div>
  )
}

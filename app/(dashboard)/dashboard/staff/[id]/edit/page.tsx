import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StaffForm } from '@/components/staff/StaffForm'

export default async function EditStaffPage({
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

  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (error || !staff) notFound()

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, description')
    .eq('business_id', business.id)
    .order('name')

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Editar empleado</h1>
      <p className="text-zinc-400 mb-8">{staff.name}</p>
      <StaffForm businessId={business.id} staff={staff} initialRoles={roles ?? []} />
    </div>
  )
}

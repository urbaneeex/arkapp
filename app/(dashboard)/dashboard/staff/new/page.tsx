import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { StaffForm } from '@/components/staff/StaffForm'

export default async function NewStaffPage() {
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

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, description')
    .eq('business_id', business.id)
    .order('name')

  return (
    <div className="max-w-xl">
      <PageHeader title="Nuevo empleado" subtitle="Añade un empleado o miembro del equipo" />
      <StaffForm businessId={business.id} staff={undefined} initialRoles={roles ?? []} />
    </div>
  )
}

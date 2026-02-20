import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Nuevo empleado</h1>
      <p className="text-zinc-400 mb-8">Añade un empleado o miembro del equipo</p>
      <StaffForm businessId={business.id} staff={undefined} initialRoles={roles ?? []} />
    </div>
  )
}

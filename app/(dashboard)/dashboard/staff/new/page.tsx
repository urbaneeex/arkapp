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

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Nuevo empleado</h1>
      <p className="text-gray-600 mb-8">Añade un empleado o miembro del equipo</p>
      <StaffForm businessId={business.id} />
    </div>
  )
}

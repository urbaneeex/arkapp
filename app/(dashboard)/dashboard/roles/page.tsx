import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RolesManagement } from '@/components/roles/RolesManagement'

export default async function RolesPage() {
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
    .select('*')
    .eq('business_id', business.id)
    .order('name')

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, role_id')
    .eq('business_id', business.id)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-100">Roles</h1>
        <p className="text-zinc-400 mt-1">
          Gestiona los roles y permisos de tu equipo
        </p>
      </div>
      <RolesManagement businessId={business.id} initialRoles={roles ?? []} initialStaff={staff ?? []} />
    </div>
  )

}

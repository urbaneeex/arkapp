import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
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
    .is('deleted_at', null)

  return (
    <div>
      <PageHeader title="Roles" subtitle="Gestiona los roles y permisos de tu equipo" />
      <RolesManagement businessId={business.id} initialRoles={roles ?? []} initialStaff={staff ?? []} />
    </div>
  )

}

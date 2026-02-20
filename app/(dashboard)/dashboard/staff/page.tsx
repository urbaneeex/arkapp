import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StaffClient } from '@/components/staff/StaffClient'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { getBusinessIdForUser } from '@/lib/supabase/business'

export default async function StaffPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const businessId = await getBusinessIdForUser(user.id)
  if (!businessId) {
    return <div>No tienes un negocio configurado</div>
  }

  const [staffResult, rolesResult] = await Promise.all([
    supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .order('name'),
    supabase
      .from('roles')
      .select('id, business_id, name, description, created_at')
      .eq('business_id', businessId)
      .order('name'),
  ])

  if (staffResult.error) {
    return (
      <div className="p-4 bg-red-950/50 text-red-300 rounded-lg">
        Error al cargar empleados: {staffResult.error.message || 'Error desconocido'}
      </div>
    )
  }

  return (
    <RequirePermission permission="staff_view">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-1">Equipo</h1>
        <p className="text-zinc-400 mb-8">
          Gestiona empleados, turnos, roles y permisos
        </p>
        <StaffClient
          staff={staffResult.data ?? []}
          businessId={businessId}
          roles={rolesResult.data ?? []}
        />
      </div>
    </RequirePermission>
  )
}

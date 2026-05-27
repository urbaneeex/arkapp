import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { StaffClient } from '@/components/staff/StaffClient'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { getBusinessForUser } from '@/lib/supabase/business'

export const metadata: Metadata = {
  title: 'Organización',
}

export default async function StaffPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) {
    return <div>No tienes un negocio configurado</div>
  }
  const businessId = businessResult.business.id

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
    <RequirePermission anyOf={['staff_view', 'teams_view', 'teams_manage']}>
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Cargando...</div>}>
        <StaffClient
          staff={staffResult.data ?? []}
          businessId={businessId}
          roles={rolesResult.data ?? []}
          staffForPicker={(staffResult.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
        />
      </Suspense>
    </RequirePermission>
  )
}

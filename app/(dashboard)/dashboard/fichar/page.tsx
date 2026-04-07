import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { EmployeePortal } from '@/components/fichar/EmployeePortal'
import { DEFAULT_MATRIX, mergeWithDefault } from '@/lib/permissions'

async function resolveStaffId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; email?: string }
): Promise<{
  staffId: string
  staffName: string
  businessId: string
  accessLevel: string
  customPermissions: null
} | null> {
  // 1. By user id
  const { data: byId } = await supabase
    .from('staff')
    .select('id, name, business_id, access_level')
    .eq('id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (byId?.business_id) {
    return {
      staffId: byId.id,
      staffName: byId.name,
      businessId: byId.business_id,
      accessLevel: byId.access_level ?? 'basico',
      customPermissions: null,
    }
  }

  // 2. By email
  if (user.email) {
    const { data: byEmail } = await supabase
      .from('staff')
      .select('id, name, business_id, access_level')
      .eq('email', user.email)
      .is('deleted_at', null)
      .maybeSingle()

    if (byEmail?.business_id) {
      return {
        staffId: byEmail.id,
        staffName: byEmail.name,
        businessId: byEmail.business_id,
        accessLevel: byEmail.access_level ?? 'basico',
        customPermissions: null,
      }
    }
  }

  // 3. Owner — auto-create staff record
  const { data: ownerBusiness } = await supabase
    .from('businesses')
    .select('id, owner_name')
    .eq('owner_uid', user.id)
    .maybeSingle()

  if (!ownerBusiness) return null

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return null

  const admin = createAdminClient(supabaseUrl, serviceKey)
  const displayName = ownerBusiness.owner_name ?? user.email ?? 'Propietario'

  const { data: newStaff } = await admin
    .from('staff')
    .insert({
      id: user.id,
      business_id: ownerBusiness.id,
      name: displayName,
      email: user.email ?? null,
      role: 'Propietario',
      access_level: 'propietario',
      is_active: true,
      invitation_status: 'accepted',
    })
    .select('id, name, business_id, access_level, custom_permissions')
    .single()

  if (!newStaff) return null
  return {
    staffId: newStaff.id,
    staffName: newStaff.name,
    businessId: newStaff.business_id,
    accessLevel: 'propietario',
    customPermissions: null,
  }
}

export default async function FicharPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolved = await resolveStaffId(supabase, user)

  if (!resolved) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-zinc-400">No estás asociado a ningún negocio.</p>
      </div>
    )
  }

  const { staffId, staffName, businessId, accessLevel, customPermissions } = resolved

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, clock_in_method, geofence_lat, geofence_lng, geofence_radius_meters')
    .eq('id', businessId)
    .single()

  if (!business) redirect('/dashboard')

  const { data: openEntry } = await supabase
    .from('time_entries')
    .select('id, clock_in, source')
    .eq('staff_id', staffId)
    .eq('business_id', businessId)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Resolve permissions
  const levelId = (accessLevel as keyof typeof DEFAULT_MATRIX) in DEFAULT_MATRIX
    ? (accessLevel as keyof typeof DEFAULT_MATRIX)
    : 'basico'
  const permissions = mergeWithDefault(levelId, customPermissions)
  const canManageAbsences = permissions.absences_manage

  // Get contract hours for overtime calculation
  const { data: staffRecord } = await supabase
    .from('staff')
    .select('contract_hours_per_week')
    .eq('id', staffId)
    .maybeSingle()

  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-zinc-500 text-sm">Cargando...</div>}>
      <EmployeePortal
        staffId={staffId}
        staffName={staffName}
        businessId={businessId}
        businessName={business.name ?? ''}
        clockInMethod={(business.clock_in_method as 'manual' | 'qr' | 'gps') ?? 'manual'}
        geofenceRadius={business.geofence_radius_meters ?? 200}
        openEntry={openEntry ? { id: openEntry.id, clock_in: openEntry.clock_in, source: openEntry.source ?? '' } : null}
        canManageAbsences={canManageAbsences}
        contractHoursPerWeek={staffRecord?.contract_hours_per_week ?? null}
      />
    </Suspense>
  )
}

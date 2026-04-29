import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { StaffForm } from '@/components/staff/StaffForm'
import { MyTeamsStrip } from '@/components/teams/MyTeamsStrip'

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

  const isOwnProfile = user.id === staff.id

  const { data: pendingInvite } = await supabase
    .from('staff_invites')
    .select('id')
    .eq('staff_id', staff.id)
    .eq('used', false)
    .maybeSingle()

  const hasPendingInvite = !!pendingInvite

  const { data: roles } = await supabase
    .from('roles')
    .select('id, name, description')
    .eq('business_id', business.id)
    .order('name')

  return (
    <div className="max-w-xl">
      <PageHeader title="Editar empleado" />
      <StaffForm
        businessId={business.id}
        staff={staff}
        initialRoles={roles ?? []}
        hasPendingInvite={hasPendingInvite}
      />
      {isOwnProfile ? (
        <section className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <h2 className="font-display text-lg font-semibold text-zinc-100">Mis equipos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Equipos a los que perteneces en este negocio (solo lectura).
          </p>
          <div className="mt-4">
            <MyTeamsStrip />
          </div>
        </section>
      ) : null}
    </div>
  )
}

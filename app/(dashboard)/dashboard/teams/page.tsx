import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { TeamsPageClient } from '@/components/teams/TeamsPageClient'
import { getBusinessForUser } from '@/lib/supabase/business'

export const metadata: Metadata = {
  title: 'Equipos',
}

export default async function TeamsPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) redirect('/dashboard')
  const businessId = businessResult.business.id

  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, name')
    .eq('business_id', businessId)
    .order('name')

  const staffForPicker = (staffRows ?? []).map((s) => ({
    id: s.id,
    name: s.name,
  }))

  return (
    <RequirePermission permission="teams_view">
      <div className="max-w-6xl space-y-6">
        <PageHeader title="Equipos" />
        <TeamsPageClient staffForPicker={staffForPicker} />
      </div>
    </RequirePermission>
  )
}

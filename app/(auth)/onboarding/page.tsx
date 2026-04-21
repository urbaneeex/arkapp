import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from '@/components/auth/OnboardingForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configura tu negocio' }

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Si ya tiene negocio o es staff, redirigir al dashboard
  const [{ data: existingBusiness }, { data: staffRow }] = await Promise.all([
    supabase.from('businesses').select('id').eq('owner_uid', user.id).maybeSingle(),
    supabase.from('staff').select('business_id').eq('id', user.id).is('deleted_at', null).maybeSingle(),
  ])

  if (existingBusiness?.id || staffRow?.business_id) {
    redirect('/dashboard')
  }

  const defaultName: string = (user.user_metadata?.full_name as string) ?? (user.user_metadata?.name as string) ?? ''

  return <OnboardingForm userId={user.id} defaultName={defaultName} />
}

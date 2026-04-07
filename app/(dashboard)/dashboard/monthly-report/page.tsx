import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonthlyReportView } from '@/components/staff/MonthlyReportView'

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ business_id?: string; staff_id?: string; year?: string; month?: string }>
}) {
  const params = await searchParams
  const { business_id, staff_id, year: yearStr, month: monthStr } = params

  if (!business_id || !yearStr || !monthStr) {
    redirect('/dashboard')
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify owner access
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', business_id)
    .eq('owner_uid', user.id)
    .maybeSingle()

  if (!business) redirect('/dashboard')

  // Fetch staff record
  const staffQuery = supabase
    .from('staff')
    .select('id, name, dni, contract_hours_per_week')
    .eq('business_id', business_id)
    .is('deleted_at', null)

  let staffMember: { id: string; name: string; dni: string | null; contract_hours_per_week: number | null } | null = null

  if (staff_id) {
    const { data } = await staffQuery.eq('id', staff_id).maybeSingle()
    staffMember = data
  }

  // Build date range for the month
  const from = new Date(year, month - 1, 1).toISOString()
  const to = new Date(year, month, 0, 23, 59, 59).toISOString()

  // Fetch time entries
  let entriesQuery = supabase
    .from('time_entries')
    .select('id, clock_in, clock_out, hours_worked, source, break_start, break_end')
    .eq('business_id', business_id)
    .gte('clock_in', from)
    .lte('clock_in', to)
    .order('clock_in', { ascending: true })

  if (staff_id) {
    entriesQuery = entriesQuery.eq('staff_id', staff_id)
  }

  const { data: entries } = await entriesQuery

  // Check for existing signature for this month
  const period = `${year}-${String(month).padStart(2, '0')}`
  let signature = null
  if (staff_id) {
    const { data: sig } = await supabase
      .from('staff_signatures')
      .select('signed_at, status')
      .eq('staff_id', staff_id)
      .eq('document_type', 'time_report')
      .eq('reference_period', period)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    signature = sig
  }

  return (
    <div className="min-h-screen bg-zinc-950 print:bg-white">
      <MonthlyReportView
        businessName={business.name ?? ''}
        staffName={staffMember?.name ?? 'Todos los empleados'}
        staffDni={staffMember?.dni ?? null}
        contractHoursPerWeek={staffMember?.contract_hours_per_week ?? null}
        year={year}
        month={month}
        entries={entries ?? []}
        staffId={staff_id ?? ''}
        businessId={business_id}
        signature={signature}
      />
    </div>
  )
}

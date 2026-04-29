import { createClient, getCachedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/layout/PageHeader'
import { FinancesPageClient } from '@/components/finances/FinancesPageClient'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { getBusinessForUser } from '@/lib/supabase/business'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  endOfDay,
} from 'date-fns'

export const metadata: Metadata = {
  title: 'Finanzas',
}

export default async function FinancesPage() {
  const user = await getCachedUser()
  if (!user) redirect('/login')

  const supabase = await createClient()

  const businessResult = await getBusinessForUser(user.id)
  if (!businessResult) redirect('/dashboard')
  const businessId = businessResult.business.id

  const monthStart = startOfMonth(new Date()).toISOString()
  const monthEnd = endOfMonth(new Date()).toISOString()

  const [
    { data: incomeAppointments },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, start_time, price_total, payment_status, clients(name), services(name), staff(name)'
      )
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd)
      .order('start_time', { ascending: false }),
    supabase
      .from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false }),
  ])

  const incomeData = (incomeAppointments ?? []).map((apt: any) => ({
    id: apt.id,
    date: apt.start_time,
    client: Array.isArray(apt.clients) ? apt.clients[0]?.name : apt.clients?.name,
    service: Array.isArray(apt.services) ? apt.services[0]?.name : apt.services?.name,
    staff: Array.isArray(apt.staff) ? apt.staff[0]?.name : apt.staff?.name,
    amount: apt.price_total ?? 0,
    payment_status: apt.payment_status,
  }))

  const monthIncome = incomeData.reduce((s, i) => s + Number(i.amount), 0)
  const monthExpenses = (expenses ?? []).filter(
    (e) => e.date >= monthStart.slice(0, 10) && e.date <= monthEnd.slice(0, 10)
  )
  const monthExpensesTotal = monthExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const margin =
    monthIncome > 0
      ? Math.round(((monthIncome - monthExpensesTotal) / monthIncome) * 100)
      : 0

  return (
    <RequirePermission permission="finances_view">
      <div>
        <PageHeader title="Finanzas" />
        <FinancesPageClient
          businessId={businessId}
        incomeData={incomeData}
        expenses={expenses ?? []}
        kpis={{
          balance: monthIncome - monthExpensesTotal,
          incomeMonth: monthIncome,
          expensesMonth: monthExpensesTotal,
          marginPercent: margin,
        }}
      />
      </div>
    </RequirePermission>
  )
}

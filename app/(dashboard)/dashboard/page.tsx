import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Users, Scissors, DollarSign } from 'lucide-react'
import { startOfToday, endOfToday, startOfMonth, endOfMonth } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_uid', user.id)
    .single()

  if (!business) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="font-medium">No tienes un negocio configurado</p>
        <p className="mt-1 text-sm">
          Contacta al administrador para asociar tu cuenta a un negocio.
        </p>
      </div>
    )
  }

  const todayStart = startOfToday().toISOString()
  const todayEnd = endOfToday().toISOString()
  const monthStart = startOfMonth(new Date()).toISOString()
  const monthEnd = endOfMonth(new Date()).toISOString()

  const [
    { count: todayCount },
    { count: clientsCount },
    { count: servicesCount },
    { data: revenueData },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .in('status', ['pending', 'confirmed', 'in_progress']),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase
      .from('appointments')
      .select('price_total')
      .eq('business_id', business.id)
      .eq('status', 'completed')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
  ])

  const revenue =
    revenueData?.reduce((acc, row) => acc + (row.price_total ?? 0), 0) ?? 0

  const stats = [
    {
      title: 'Citas hoy',
      value: todayCount ?? 0,
      icon: Calendar,
      href: '/dashboard/appointments',
      color: 'bg-[#2563eb] text-white',
    },
    {
      title: 'Clientes',
      value: clientsCount ?? 0,
      icon: Users,
      href: '/dashboard/clients',
      color: 'bg-emerald-600 text-white',
    },
    {
      title: 'Servicios',
      value: servicesCount ?? 0,
      icon: Scissors,
      href: '/dashboard/services',
      color: 'bg-violet-600 text-white',
    },
    {
      title: 'Ingresos del mes',
      value: new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(revenue),
      icon: DollarSign,
      href: '/dashboard/appointments',
      color: 'bg-amber-600 text-white',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Hola, {business.name}
      </h1>
      <p className="text-gray-600 mb-8">Resumen de tu negocio</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ title, value, icon: Icon, href, color }) => (
          <Link key={title} href={href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

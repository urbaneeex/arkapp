import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Users,
  Briefcase,
  DollarSign,
  Settings,
  TrendingUp,
  UserX,
  Clock,
} from 'lucide-react'
import {
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
} from 'date-fns'
import { es } from 'date-fns/locale'

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
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()
  const monthStart = startOfMonth(new Date()).toISOString()
  const monthEnd = endOfMonth(new Date()).toISOString()

  const [
    { count: todayCount },
    { count: weekCount },
    { count: clientsCount },
    { count: servicesCount },
    { data: revenueData },
    { data: monthAppointments },
    { count: noShowCount },
    { data: nextAppointments },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('start_time', todayStart)
      .lte('start_time', todayEnd)
      .in('status', ['pending', 'confirmed', 'in_progress']),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('start_time', weekStart)
      .lte('start_time', weekEnd)
      .in('status', ['pending', 'confirmed', 'in_progress', 'completed']),
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
    supabase
      .from('appointments')
      .select('id, status')
      .eq('business_id', business.id)
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'no_show')
      .gte('start_time', monthStart)
      .lte('start_time', monthEnd),
    supabase
      .from('appointments')
      .select(
        'id, start_time, end_time, status, clients(name), services(name)'
      )
      .eq('business_id', business.id)
      .gte('start_time', todayStart)
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .order('start_time', { ascending: true })
      .limit(5),
  ])

  const revenue =
    revenueData?.reduce((acc, row) => acc + (row.price_total ?? 0), 0) ?? 0
  const totalMonth = monthAppointments?.length ?? 0
  const completedMonth =
    monthAppointments?.filter((a) => a.status === 'completed').length ?? 0
  const occupancyRate =
    totalMonth > 0 ? Math.round((completedMonth / totalMonth) * 100) : 0
  const noShowRate =
    totalMonth > 0 ? Math.round(((noShowCount ?? 0) / totalMonth) * 100) : 0

  const stats = [
    {
      title: 'Citas hoy',
      value: todayCount ?? 0,
      icon: Calendar,
      href: '/dashboard/calendar',
      color: 'bg-[#2563eb] text-white',
    },
    {
      title: 'Citas esta semana',
      value: weekCount ?? 0,
      icon: Clock,
      href: '/dashboard/calendar',
      color: 'bg-blue-500 text-white',
    },
    {
      title: 'Clientes activos',
      value: clientsCount ?? 0,
      icon: Users,
      href: '/dashboard/clients',
      color: 'bg-emerald-600 text-white',
    },
    {
      title: 'Ingresos del mes',
      value: new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(revenue),
      icon: DollarSign,
      href: '/dashboard/finances',
      color: 'bg-amber-600 text-white',
    },
    {
      title: 'Tasa de ocupación',
      value: `${occupancyRate}%`,
      icon: TrendingUp,
      href: '/dashboard/reports',
      color: 'bg-violet-600 text-white',
    },
    {
      title: 'Tasa no-show',
      value: `${noShowRate}%`,
      icon: UserX,
      href: '/dashboard/reports',
      color: 'bg-gray-600 text-white',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Hola, {business.name}
      </h1>
      <p className="text-gray-600 mb-8">Resumen de tu negocio</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map(({ title, value, icon: Icon, href, color }) => (
          <Link key={title} href={href} className="cursor-pointer">
            <Card className="h-32 p-6 hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {title}
                </CardTitle>
                <div className={`rounded-lg p-2 shrink-0 ${color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent className="p-0 pt-2 flex-1 flex items-end">
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Próximas citas</CardTitle>
          </CardHeader>
          <CardContent>
            {nextAppointments && nextAppointments.length > 0 ? (
              <ul className="space-y-3">
                {nextAppointments.map((apt: any) => {
                  const clientName = Array.isArray(apt.clients)
                    ? apt.clients[0]?.name
                    : apt.clients?.name
                  const serviceName = Array.isArray(apt.services)
                    ? apt.services[0]?.name
                    : apt.services?.name
                  return (
                    <li key={apt.id}>
                      <Link
                        href={`/dashboard/appointments/${apt.id}/edit`}
                        className="cursor-pointer flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {clientName ?? 'Sin cliente'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {serviceName ?? 'Sin servicio'} ·{' '}
                            {format(
                              new Date(apt.start_time),
                              "HH:mm",
                              { locale: es }
                            )}
                          </p>
                        </div>
                        <Badge variant={apt.status as any}>
                          {apt.status}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 py-4">
                No hay citas programadas para hoy.
              </p>
            )}
            <Link
              href="/dashboard/calendar"
              className="mt-4 inline-block text-sm font-medium text-[#2563eb] hover:underline cursor-pointer"
            >
              Ver calendario →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/appointments/new"
                className="cursor-pointer rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50"
              >
                <Calendar className="mx-auto h-6 w-6 text-[#2563eb]" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Nueva cita
                </p>
              </Link>
              <Link
                href="/dashboard/clients/new"
                className="cursor-pointer rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50"
              >
                <Users className="mx-auto h-6 w-6 text-emerald-600" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Nuevo cliente
                </p>
              </Link>
              <Link
                href="/dashboard/services"
                className="cursor-pointer rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50"
              >
                <Briefcase className="mx-auto h-6 w-6 text-violet-600" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Servicios
                </p>
              </Link>
              <Link
                href="/dashboard/settings"
                className="cursor-pointer rounded-lg border border-gray-200 p-4 text-center hover:bg-gray-50"
              >
                <Settings className="mx-auto h-6 w-6 text-amber-600" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Configuración
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

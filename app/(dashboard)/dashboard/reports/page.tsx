import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default async function ReportsPage() {
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

  if (!business) redirect('/dashboard')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reportes y analíticas</h1>
      <p className="text-gray-600 mb-8">
        Ingresos, ocupación y rendimiento de tu negocio
      </p>

      <EmptyState
        icon={<BarChart3 className="h-6 w-6" />}
        title="Reportes en construcción"
        description="Próximamente: ingresos totales, por servicio, por empleado, top clientes, tasa de ocupación, exportar PDF/Excel."
      />
    </div>
  )
}

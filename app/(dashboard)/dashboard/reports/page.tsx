import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/empty-state'
import { RequirePermission } from '@/components/auth/RequirePermission'

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <RequirePermission permission="reports_view">
      <div>
        <PageHeader title="Reportes y analíticas" subtitle="Ingresos, ocupación y rendimiento de tu negocio" />

        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Reportes en construcción"
          description="Próximamente: ingresos totales, por servicio, por empleado, top clientes, tasa de ocupación, exportar PDF/Excel."
        />
      </div>
    </RequirePermission>
  )
}

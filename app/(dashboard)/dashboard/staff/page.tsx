import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { StaffList } from '@/components/staff/StaffList'

export default async function StaffPage() {
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

  if (!business) {
    return <div>No tienes un negocio configurado</div>
  }

  const { data: staff, error } = await supabase
    .from('staff')
    .select('*')
    .eq('business_id', business.id)
    .order('name')

  if (error) {
    console.error(error)
    return <div>Error al cargar empleados</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-600 mt-1">
            Empleados y profesionales ({staff?.length ?? 0})
          </p>
        </div>
        <Link href="/dashboard/staff/new" className="cursor-pointer">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo empleado
          </Button>
        </Link>
      </div>
      <StaffList staff={staff ?? []} businessId={business.id} />
    </div>
  )
}

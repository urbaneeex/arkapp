import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientsList from '@/components/clients/ClientsList'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const supabase = await createClient()
  
  // 1. Verificar autenticación
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  
  // 2. Obtener el negocio del usuario actual
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_uid', session.user.id)
    .single()
  
  if (!business) {
    return <div>No tienes un negocio configurado</div>
  }
  
  // 3. Obtener TODOS los clientes de este negocio
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error:', error)
    return <div>Error al cargar clientes</div>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tu base de clientes ({clients?.length || 0})
          </p>
        </div>
        
        <Link href="/dashboard/clients/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </Link>
      </div>

      {/* Lista de clientes */}
      <ClientsList clients={clients || []} />
    </div>
  )
}
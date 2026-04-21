import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil } from 'lucide-react'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
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

  if (!business) redirect('/dashboard')

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (error || !client) notFound()

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/clients" className="cursor-pointer">
          <Button variant="ghost" size="icon" className="cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-zinc-100">{client.name}</h1>
        </div>
        <Link href={`/dashboard/clients/${client.id}/edit`} className="cursor-pointer">
          <Button className="cursor-pointer">
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </Link>
      </div>
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase">Teléfono</p>
          <p className="text-zinc-100">{client.phone}</p>
        </div>
        {client.email && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase">Email</p>
            <p className="text-zinc-100">{client.email}</p>
          </div>
        )}
        {client.address && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase">Dirección</p>
            <p className="text-zinc-100">{client.address}</p>
          </div>
        )}
        {client.notes && (
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase">Notas</p>
            <p className="text-zinc-100 whitespace-pre-wrap">{client.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

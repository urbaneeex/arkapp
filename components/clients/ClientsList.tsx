import Link from 'next/link'
import { Database } from '@/types/database.types'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsListProps {
  clients: Client[]
}

export default function ClientsList({ clients }: ClientsListProps) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400 text-lg">No hay clientes registrados</p>
        <p className="text-zinc-400 text-sm mt-2">
          Comienza agregando tu primer cliente
        </p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-zinc-950">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Teléfono
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Dirección
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-zinc-900 divide-y divide-gray-200">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-zinc-950 cursor-pointer">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-zinc-100">
                  {client.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-zinc-400">{client.phone}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-zinc-400">{client.email || '-'}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-zinc-400">
                  {client.address || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="text-brand hover:text-brand cursor-pointer"
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

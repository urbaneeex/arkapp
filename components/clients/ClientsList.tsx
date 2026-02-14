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
        <p className="text-gray-500 text-lg">No hay clientes registrados</p>
        <p className="text-gray-400 text-sm mt-2">
          Comienza agregando tu primer cliente
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Teléfono
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dirección
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {client.name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{client.phone}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{client.email || '-'}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-500">
                  {client.address || '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="text-blue-600 hover:text-blue-900"
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

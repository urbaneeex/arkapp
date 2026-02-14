import ClientForm from '@/app/(dashboard)/dashboard/clients/clientForm'

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Nuevo Cliente</h1>
      <p className="text-gray-600 mb-8">
        Añade un nuevo cliente a tu base de datos
      </p>
      
      <ClientForm />
    </div>
  )
}
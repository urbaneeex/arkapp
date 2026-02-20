import { PageHeader } from '@/components/layout/PageHeader'
import ClientForm from '@/app/(dashboard)/dashboard/clients/clientForm'

export default function NewClientPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Nuevo cliente" subtitle="Añade un nuevo cliente a tu base de datos" />
      <ClientForm />
    </div>
  )
}
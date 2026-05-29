import { redirect } from 'next/navigation'

/** Equipos vive en Empresa → pestaña equipos. */
export default function TeamsPage() {
  redirect('/dashboard/staff?tab=equipos')
}

import { redirect } from 'next/navigation'

/** Equipos vive en Organización → pestaña equipos. */
export default function TeamsPage() {
  redirect('/dashboard/staff?tab=equipos')
}

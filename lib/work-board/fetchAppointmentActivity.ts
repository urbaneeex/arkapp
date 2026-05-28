import type { AppointmentActivityItem } from '@/lib/work-board/appointmentActivityTypes'

export async function fetchAppointmentActivity(
  appointmentId: string
): Promise<AppointmentActivityItem[]> {
  const res = await fetch(`/api/work-items/${appointmentId}/activity`)
  if (!res.ok) throw new Error('activity')
  const json = (await res.json()) as { items?: AppointmentActivityItem[] }
  return json.items ?? []
}

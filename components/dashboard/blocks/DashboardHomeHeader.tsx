import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export function DashboardHomeHeader({ displayName }: { displayName: string }) {
  const dateLine = format(new Date(), "EEEE, d 'de' MMMM", { locale: es })
  const capitalized = dateLine.charAt(0).toUpperCase() + dateLine.slice(1)

  return (
    <header className="mb-5 shrink-0 md:mb-6">
      <h1 className="font-display text-2xl font-bold text-zinc-100">
        Hola, {displayName}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">{capitalized}</p>
    </header>
  )
}

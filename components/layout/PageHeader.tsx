'use client'

/**
 * Encabezado estándar de sección del dashboard.
 * Título: font-display text-2xl font-bold.
 */
export function PageHeader({
  title,
  className = '',
}: {
  title: React.ReactNode
  className?: string
}) {
  return (
    <header className={`mb-6 ${className}`.trim()}>
      <h1 className="font-display text-2xl font-bold text-zinc-100">{title}</h1>
    </header>
  )
}

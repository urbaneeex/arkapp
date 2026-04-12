'use client'

/**
 * Encabezado estándar de sección del dashboard.
 * Título: text-2xl font-bold. Subtítulo: text-sm text-zinc-400.
 */
export function PageHeader({
  title,
  subtitle,
  className = '',
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  className?: string
}) {
  return (
    <header className={`mb-6 ${className}`.trim()}>
      <h1 className="font-display text-2xl font-bold text-zinc-100">
        {title}
      </h1>
      {subtitle != null && (
        <p className="text-sm text-zinc-400 mt-1">
          {subtitle}
        </p>
      )}
    </header>
  )
}

'use client'

import Link from 'next/link'

export function AuthMethodButton({
  icon,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="auth-method"
      {...props}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="shrink-0 text-lg" aria-hidden>
        →
      </span>
    </button>
  )
}

export function AuthOrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-[#f1f0ec]/55">
      <span className="h-px flex-1 bg-[#f1f0ec]/[0.18]" />
      <span className="auth-label shrink-0">o</span>
      <span className="h-px flex-1 bg-[#f1f0ec]/[0.18]" />
    </div>
  )
}

export function AuthLegalFooter() {
  return (
    <p className="mt-8 text-[12px] leading-relaxed text-[#f1f0ec]/55">
      Al continuar, acepto los{' '}
      <Link href="/terminos" className="auth-link">
        Términos y condiciones
      </Link>{' '}
      y la{' '}
      <Link href="/privacidad" className="auth-link">
        Política de protección de datos
      </Link>
      .
    </p>
  )
}

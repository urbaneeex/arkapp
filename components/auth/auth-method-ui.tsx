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
      className="flex h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-[#3a3a3c] bg-[#2c2c2e] px-4 text-left text-sm font-medium text-white transition-colors hover:bg-[#363639] disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className="shrink-0 text-lg text-[#8e8e93]" aria-hidden>
        →
      </span>
    </button>
  )
}

export function AuthOrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-[#8e8e93]">
      <span className="h-px flex-1 bg-[#3a3a3c]" />
      <span className="shrink-0 font-medium">o</span>
      <span className="h-px flex-1 bg-[#3a3a3c]" />
    </div>
  )
}

export function AuthLegalFooter() {
  return (
    <p className="mt-8 text-center text-[12px] leading-relaxed text-[#8e8e93]">
      Al continuar, acepto los{' '}
      <Link href="/terminos" className="text-brand hover:underline">
        Términos y condiciones
      </Link>{' '}
      y la{' '}
      <Link href="/privacidad" className="text-brand hover:underline">
        Política de protección de datos
      </Link>
      .
    </p>
  )
}

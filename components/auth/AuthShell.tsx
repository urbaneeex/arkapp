import Link from 'next/link'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell flex min-h-screen flex-col bg-[#0b0b0b] px-5 text-[#f1f0ec] sm:px-10">
      <header className="flex items-center justify-between py-6">
        <Link href="/login" className="font-display text-2xl font-medium tracking-[-0.035em]">
          Arkapp<span className="text-brand">.</span>
        </Link>
        <span className="auth-label">(Acceso)</span>
      </header>

      <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-12">
        <h2
          className="auth-rise font-display hidden text-[clamp(3.4rem,7vw,7.5rem)] font-medium leading-[0.95] tracking-[-0.035em] lg:col-span-7 lg:block"
          aria-hidden
        >
          Tu negocio,
          <br />
          bajo control<span className="text-brand">.</span>
        </h2>
        <div
          className="auth-rise w-full max-w-md justify-self-center lg:col-span-5 lg:justify-self-end"
          style={{ '--d': '0.12s' } as React.CSSProperties}
        >
          {children}
        </div>
      </main>

      <footer className="flex items-center justify-between border-t border-[#f1f0ec]/[0.18] py-5">
        <span className="auth-label">© {new Date().getFullYear()} Arkapp</span>
        <a href="mailto:hello@arkapp.es" className="auth-label transition-colors hover:text-[#f1f0ec]">
          hello@arkapp.es
        </a>
      </footer>
    </div>
  )
}

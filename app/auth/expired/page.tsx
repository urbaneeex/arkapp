'use client'

import Link from 'next/link'
import { AuthShell } from '@/components/auth/AuthShell'
import { Clock } from 'lucide-react'

export default function InviteExpiredPage() {
  return (
    <AuthShell>
      <div className="auth-card">
        <Clock className="mb-6 h-8 w-8 text-brand" strokeWidth={1.5} aria-hidden />
        <h1 className="auth-title mb-4">
          El enlace ha expirado
        </h1>
        <p className="text-[#f1f0ec]/55 mb-4">
          Este enlace de invitación ya no es válido. Los enlaces expiran después de <strong className="text-[#f1f0ec]">48 horas</strong> por seguridad.
        </p>
        <p className="text-sm text-[#f1f0ec]/55 mb-6">
          Contacta con tu administrador para que te envíe una nueva invitación. Recibirás un nuevo correo con un enlace válido.
        </p>
        <div className="space-y-3">
          <Link 
            href="/login" 
            className="auth-btn"
          >
            Volver al inicio
          </Link>
          <p className="text-xs text-[#f1f0ec]/55">
            Si ya tienes cuenta activa, inicia sesión con tu email y contraseña.
          </p>
        </div>
      </div>
    </AuthShell>
  )
}

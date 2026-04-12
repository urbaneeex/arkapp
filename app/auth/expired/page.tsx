'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

export default function InviteExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="bg-zinc-900 rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold text-zinc-100 mb-2">
          El enlace ha expirado
        </h1>
        <p className="text-zinc-400 mb-4">
          Este enlace de invitación ya no es válido. Los enlaces expiran después de <strong>7 días</strong> por seguridad.
        </p>
        <p className="text-sm text-zinc-400 mb-6">
          Contacta con tu administrador para que te envíe una nueva invitación. Recibirás un nuevo correo con un enlace válido.
        </p>
        <div className="space-y-3">
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-brand text-white hover:bg-brand-hover h-10 px-4 py-2 w-full"
          >
            Volver al inicio
          </Link>
          <p className="text-xs text-zinc-400">
            Si ya tienes cuenta activa, inicia sesión con tu email y contraseña.
          </p>
        </div>
      </div>
    </div>
  )
}

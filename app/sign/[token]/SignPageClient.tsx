'use client'

import { useEffect, useState } from 'react'
import SignaturePad from '@/components/sign/SignaturePad'
import { AlertCircle, Loader2 } from 'lucide-react'

interface SessionData {
  signatureId: string
  documentType: string
  referenceId: string | null
  referencePeriod: string | null
  staffName: string
  businessName: string
  expiresAt: string
}

const DOC_LABELS: Record<string, string> = {
  document: 'Documento',
  vacation: 'Solicitud de vacaciones',
  schedule: 'Horario',
  time_report: 'Informe mensual',
}

export default function SignPageClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionData | null>(null)

  useEffect(() => {
    fetch(`/api/sign/session?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSession(data)
        }
      })
      .catch(() => setError('No se pudo cargar la sesión de firma'))
      .finally(() => setLoading(false))
  }, [token])

  const handleConfirm = async (blob: Blob) => {
    const form = new FormData()
    form.append('signature', blob, 'signature.png')
    const res = await fetch(`/api/sign/${encodeURIComponent(token)}/confirm`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error ?? 'Error al guardar la firma')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-md p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-lg font-semibold">Enlace no válido</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Si necesitas firmar este documento, solicita un nuevo enlace a tu empresa.
          </p>
        </div>
      </main>
    )
  }

  if (!session) return null

  const docLabel = DOC_LABELS[session.documentType] ?? session.documentType

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
            {session.businessName}
          </p>
          <h1 className="text-xl font-bold">Firma de documento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {docLabel}
            {session.referencePeriod && ` · ${session.referencePeriod}`}
          </p>
          <p className="text-sm text-muted-foreground">
            Empleado: <strong>{session.staffName}</strong>
          </p>
        </div>

        {/* Signature pad */}
        <SignaturePad
          label="Dibuja tu firma con el dedo o el ratón"
          onConfirm={handleConfirm}
        />

        <p className="text-xs text-muted-foreground text-center">
          Al confirmar, consientes que tu firma quede registrada digitalmente.
        </p>
      </div>
    </main>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileText, Eye, CheckCircle, Clock, X, AlertCircle, PenLine, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { notifySuccess, notifyError } from '@/lib/notify'
import SignaturePad from '@/components/sign/SignaturePad'
import dynamic from 'next/dynamic'

const QRSignModal = dynamic(() => import('@/components/sign/QRSignModal'), { ssr: false })

type Doc = {
  id: string
  title: string
  category: string
  file_url: string
  file_name: string
  file_size: number | null
  requires_signature: boolean
  created_at: string | null
  signature_status: string | null
  signature_asset_url?: string | null
}

type SignatureRow = {
  id: string
  document_type: string
  reference_id: string | null
  reference_period: string | null
  status: string
  requested_at: string | null
  signed_at: string | null
  signature_asset_url: string | null
  doc_title?: string
}

const CATEGORIES: Record<string, string> = {
  contract: 'Contrato',
  payroll: 'Nómina',
  certificate: 'Certificado',
  id_document: 'Documento ID',
  other: 'Otro',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  document: 'Documento',
  vacation: 'Vacaciones aprobadas',
  schedule: 'Horario recurrente',
  time_report: 'Informe de fichajes',
}

type Filter = 'all' | 'pending' | 'signed'

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])
  return isTouch
}

export function MyDocuments({
  staffId,
  businessId,
}: {
  staffId: string
  businessId: string
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [allSigs, setAllSigs] = useState<SignatureRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  // Modal state for text-based sign/reject
  const [signModal, setSignModal] = useState<{ sig: SignatureRow } | null>(null)
  const [signing, setSigning] = useState(false)
  const [notes, setNotes] = useState('')

  // QR modal (desktop)
  const [qrModal, setQrModal] = useState<{ sig: SignatureRow; label: string } | null>(null)

  // Touch signature modal (mobile)
  const [touchModal, setTouchModal] = useState<{ sig: SignatureRow } | null>(null)

  // View signature image modal
  const [viewSigModal, setViewSigModal] = useState<{ url: string; label: string } | null>(null)

  const isTouch = useIsTouchDevice()
  const loadRef = useRef(false)

  const load = useCallback(async () => {
    if (loadRef.current) return
    loadRef.current = true
    setLoading(true)
    try {
      const [docsRes, sigsRes] = await Promise.all([
        fetch(`/api/staff/documents?business_id=${businessId}&staff_id=${staffId}`),
        fetch(`/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}`),
      ])
      const docsJson = await docsRes.json()
      const sigsJson = await sigsRes.json()
      if (docsRes.ok) setDocs(docsJson.data ?? [])
      if (sigsRes.ok) setAllSigs(sigsJson.data ?? [])
    } finally {
      setLoading(false)
      loadRef.current = false
    }
  }, [businessId, staffId])

  useEffect(() => { load() }, [load])

  const pendingSigs = allSigs.filter(s => s.status === 'pending')
  const signedSigs = allSigs.filter(s => s.status === 'signed')

  // Text-based sign/reject (legacy confirm flow without drawn signature)
  const handleSign = async (action: 'sign' | 'reject') => {
    if (!signModal) return
    setSigning(true)
    try {
      const res = await fetch('/api/staff/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: signModal.sig.id,
          business_id: businessId,
          action,
          notes: notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) { notifyError(json.error || 'Error'); return }
      notifySuccess(action === 'sign' ? 'Documento firmado correctamente' : 'Documento rechazado')
      setSignModal(null)
      setNotes('')
      await load()
    } finally {
      setSigning(false)
    }
  }

  // Touch signature flow – upload PNG via confirm endpoint
  const handleTouchConfirm = async (blob: Blob) => {
    if (!touchModal) throw new Error('no modal')
    // First create a sign session token
    const sessionRes = await fetch('/api/sign/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_id: touchModal.sig.id }),
    })
    const sessionData = await sessionRes.json()
    if (!sessionData.token) throw new Error(sessionData.error ?? 'Error al crear sesión')

    const form = new FormData()
    form.append('signature', blob, 'signature.png')
    const res = await fetch(`/api/sign/${encodeURIComponent(sessionData.token)}/confirm`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error ?? 'Error al guardar la firma')

    notifySuccess('Documento firmado correctamente')
    setTouchModal(null)
    await load()
  }

  const openSignFlow = (sig: SignatureRow) => {
    const label = DOC_TYPE_LABELS[sig.document_type] ?? sig.document_type
    if (isTouch) {
      setTouchModal({ sig })
    } else {
      setQrModal({ sig, label })
    }
  }

  // --- Filtered lists ---
  const pendingDocSigs = pendingSigs.filter(s => s.document_type === 'document')
  const pendingOtherSigs = pendingSigs.filter(s => s.document_type !== 'document')

  const filteredDocs = docs.filter(doc => {
    if (filter === 'pending') return pendingDocSigs.some(s => s.reference_id === doc.id)
    if (filter === 'signed') return doc.signature_status === 'signed' || signedSigs.some(s => s.reference_id === doc.id)
    return true
  })

  const filteredOtherSigs = (() => {
    if (filter === 'pending') return pendingOtherSigs
    if (filter === 'signed') return signedSigs.filter(s => s.document_type !== 'document')
    return allSigs.filter(s => s.document_type !== 'document')
  })()

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-zinc-800/40 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alert */}
      {pendingSigs.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-950/20 border border-amber-700/30 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-300">
              Tienes {pendingSigs.length} elemento{pendingSigs.length !== 1 ? 's' : ''} pendiente{pendingSigs.length !== 1 ? 's' : ''} de firma
            </p>
            <p className="text-xs text-amber-400/70 mt-0.5">Revísalos a continuación.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-800/50 p-1 w-fit">
        {(['all', 'pending', 'signed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors',
              filter === f
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : 'Firmados'}
          </button>
        ))}
      </div>

      {/* Non-document signatures (vacations, schedules, time reports) */}
      {filteredOtherSigs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            {filter === 'signed' ? 'Confirmaciones firmadas' : 'Pendiente de confirmación'}
          </h3>
          <div className="space-y-2">
            {filteredOtherSigs.map(sig => (
              <div key={sig.id} className={cn(
                'flex items-center justify-between gap-4 rounded-xl border px-4 py-3',
                sig.status === 'signed'
                  ? 'border-green-700/20 bg-green-950/10'
                  : 'border-amber-700/20 bg-amber-950/10'
              )}>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{DOC_TYPE_LABELS[sig.document_type] ?? sig.document_type}</p>
                  {sig.reference_period && <p className="text-xs text-zinc-500">Período: {sig.reference_period}</p>}
                  {sig.requested_at && (
                    <p className="text-xs text-zinc-600">
                      {sig.status === 'signed' && sig.signed_at
                        ? `Firmado ${format(parseISO(sig.signed_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}`
                        : `Solicitado ${format(parseISO(sig.requested_at), "d MMM yyyy", { locale: es })}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {sig.status === 'signed' ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-xs bg-green-950/30 text-green-400 border border-green-700/30 rounded-full px-2 py-0.5">
                        <CheckCircle className="h-3 w-3" /> Firmado
                      </span>
                      {sig.signature_asset_url && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setViewSigModal({ url: sig.signature_asset_url!, label: DOC_TYPE_LABELS[sig.document_type] ?? sig.document_type })}
                        >
                          <ImageIcon className="h-3.5 w-3.5 mr-1" />
                          Ver firma
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" onClick={() => openSignFlow(sig)}>
                      <PenLine className="h-3.5 w-3.5 mr-1" />
                      Firmar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300">Mis documentos</h3>
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-9 w-9 text-zinc-700 mb-3" />
            <p className="text-zinc-500 text-sm">
              {filter === 'pending' ? 'No tienes documentos pendientes de firma' :
               filter === 'signed' ? 'No tienes documentos firmados' :
               'No tienes documentos aún'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map(doc => {
              const pendingSig = pendingDocSigs.find(s => s.reference_id === doc.id)
              const signedSig = signedSigs.find(s => s.reference_id === doc.id && s.document_type === 'document')
              const isSigned = doc.signature_status === 'signed' || !!signedSig
              return (
                <div key={doc.id} className={cn(
                  'flex items-center gap-4 rounded-xl border px-4 py-3',
                  pendingSig ? 'border-amber-700/30 bg-amber-950/10' :
                  isSigned ? 'border-green-700/20 bg-green-950/5' :
                  'border-zinc-800 bg-zinc-900'
                )}>
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-200 truncate">{doc.title}</p>
                      {isSigned && (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-950/30 text-green-400 border border-green-700/30 rounded-full px-2 py-0.5">
                          <CheckCircle className="h-3 w-3" /> Firmado
                        </span>
                      )}
                      {pendingSig && (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-950/30 text-amber-400 border border-amber-700/30 rounded-full px-2 py-0.5">
                          <Clock className="h-3 w-3" /> Pendiente de firma
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-500">{CATEGORIES[doc.category] ?? doc.category}</span>
                      {doc.created_at && (
                        <span className="text-xs text-zinc-600">
                          · {format(parseISO(doc.created_at), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 rounded transition-colors"
                      title="Ver documento"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    {isSigned && signedSig?.signature_asset_url && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setViewSigModal({ url: signedSig.signature_asset_url!, label: doc.title })}
                      >
                        <ImageIcon className="h-3.5 w-3.5 mr-1" />
                        Ver firma
                      </Button>
                    )}
                    {pendingSig && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => openSignFlow(pendingSig)}
                      >
                        <PenLine className="h-3.5 w-3.5 mr-1" />
                        Firmar
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR modal for desktop */}
      {qrModal && (
        <QRSignModal
          open
          onClose={() => setQrModal(null)}
          signatureId={qrModal.sig.id}
          documentLabel={qrModal.label}
          onSigned={() => { setQrModal(null); load() }}
        />
      )}

      {/* Touch signature modal for mobile/tablet */}
      <Dialog open={!!touchModal} onOpenChange={open => { if (!open) setTouchModal(null) }}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Firmar documento</DialogTitle>
          </DialogHeader>
          {touchModal && (
            <SignaturePad
              label="Dibuja tu firma con el dedo"
              onConfirm={handleTouchConfirm}
              onCancel={() => setTouchModal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Legacy text-based sign modal (fallback) */}
      <Dialog open={!!signModal} onOpenChange={open => { if (!open) { setSignModal(null); setNotes('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {signModal?.sig.document_type === 'document'
                ? 'Revisar y firmar documento'
                : `Confirmar: ${DOC_TYPE_LABELS[signModal?.sig.document_type ?? ''] ?? 'Elemento'}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-zinc-800/50 rounded-lg">
              <p className="text-xs text-zinc-400">Al firmar confirmas que has leído y aceptas el contenido. Esta acción queda registrada con tu IP y la fecha/hora actual.</p>
            </div>
            <div>
              <label className="text-sm text-zinc-300 mb-1 block">Notas (opcional)</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Añade observaciones si lo deseas..."
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => handleSign('sign')} disabled={signing} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-1.5" />
                {signing ? 'Firmando...' : 'Firmar y confirmar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSign('reject')}
                disabled={signing}
                className="flex-1 border-red-700/40 text-red-400 hover:bg-red-950/20"
              >
                <X className="h-4 w-4 mr-1.5" />
                Rechazar
              </Button>
            </div>
            <Button variant="ghost" onClick={() => { setSignModal(null); setNotes('') }} className="w-full">
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View signature image modal */}
      <Dialog open={!!viewSigModal} onOpenChange={open => { if (!open) setViewSigModal(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Firma de: {viewSigModal?.label}</DialogTitle>
          </DialogHeader>
          {viewSigModal && (
            <div className="flex justify-center py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewSigModal.url}
                alt="Firma"
                className="rounded-lg border border-zinc-700 max-w-full bg-white"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

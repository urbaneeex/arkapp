'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Upload, Trash2, FileText, CheckCircle, Clock, AlertCircle, Eye, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { notifySuccess, notifyError } from '@/lib/notify'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type StaffRow = Database['public']['Tables']['staff']['Row']

type Document = {
  id: string
  staff_id: string
  title: string
  category: string
  file_url: string
  file_name: string
  file_size: number | null
  requires_signature: boolean
  created_at: string | null
  signature_status: string | null
  staff?: { id: string; name: string } | null
}

const CATEGORIES = [
  { value: 'contract', label: 'Contrato' },
  { value: 'payroll', label: 'Nómina' },
  { value: 'certificate', label: 'Certificado' },
  { value: 'id_document', label: 'Documento ID' },
  { value: 'other', label: 'Otro' },
]

function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function SignatureBadge({ status }: { status: string | null }) {
  if (!status || status === 'not_requested') return null
  if (status === 'signed') return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-950/30 text-green-400 border border-green-700/30 rounded-full px-2 py-0.5">
      <CheckCircle className="h-3 w-3" /> Firmado
    </span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 text-xs bg-red-950/30 text-red-400 border border-red-700/30 rounded-full px-2 py-0.5">
      <X className="h-3 w-3" /> Rechazado
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-950/30 text-amber-400 border border-amber-700/30 rounded-full px-2 py-0.5">
      <Clock className="h-3 w-3" /> Pendiente de firma
    </span>
  )
}

const EMPTY_FORM = {
  staff_id: '',
  title: '',
  category: 'other',
  requires_signature: false,
}

export function DocumentsTab({
  businessId,
  staff,
}: {
  businessId: string
  staff: StaffRow[]
}) {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStaff, setFilterStaff] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const activeStaff = staff.filter(s => s.is_active && !s.deleted_at)

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ business_id: businessId })
      if (filterStaff !== 'all') params.set('staff_id', filterStaff)
      const res = await fetch(`/api/staff/documents?${params}`)
      const json = await res.json()
      if (res.ok) setDocs(json.data ?? [])
      else notifyError(json.error || 'Error cargando documentos')
    } finally {
      setLoading(false)
    }
  }, [businessId, filterStaff])

  useEffect(() => { loadDocs() }, [loadDocs])

  const handleUpload = async () => {
    if (!file || !form.staff_id || !form.title.trim()) {
      notifyError('Completa todos los campos y selecciona un archivo')
      return
    }
    setUploading(true)
    try {
      const staffMember = activeStaff.find(s => s.id === form.staff_id)
      const path = `businesses/${businessId}/staff/${form.staff_id}/${Date.now()}_${file.name}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('staff-documents')
        .upload(path, file, { upsert: false })

      if (uploadError) {
        notifyError(`Error subiendo archivo: ${uploadError.message}`)
        return
      }

      const { data: urlData } = supabase.storage
        .from('staff-documents')
        .getPublicUrl(uploadData.path)

      const res = await fetch('/api/staff/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          staff_id: form.staff_id,
          title: form.title.trim(),
          category: form.category,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          requires_signature: form.requires_signature,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        notifyError(json.error || 'Error guardando documento')
        return
      }

      notifySuccess('Documento subido correctamente')
      setModalOpen(false)
      setForm({ ...EMPTY_FORM })
      setFile(null)
      await loadDocs()
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`¿Eliminar "${doc.title}"? Esta acción no se puede deshacer.`)) return
    setDeletingId(doc.id)
    try {
      const params = new URLSearchParams({ id: doc.id, business_id: businessId })
      const res = await fetch(`/api/staff/documents?${params}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) { notifyError(json.error || 'Error eliminando'); return }
      notifySuccess('Documento eliminado')
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <select
          value={filterStaff}
          onChange={e => setFilterStaff(e.target.value)}
          className="h-9 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="all">Todos los empleados</option>
          {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button size="sm" onClick={() => {
          setForm({ ...EMPTY_FORM, staff_id: activeStaff[0]?.id ?? '' })
          setFile(null)
          setModalOpen(true)
        }}>
          <Upload className="h-4 w-4 mr-1.5" />
          Subir documento
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-zinc-800/40 rounded-lg animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No hay documentos</p>
          <p className="text-zinc-600 text-xs mt-1">Sube el primer documento con el botón superior</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 overflow-hidden divide-y divide-zinc-800">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-4 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition-colors">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                <FileText className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-200 truncate">{doc.title}</p>
                  <SignatureBadge status={doc.signature_status} />
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-xs text-zinc-500">{categoryLabel(doc.category)}</span>
                  {doc.staff?.name && <span className="text-xs text-zinc-500">· {doc.staff.name}</span>}
                  {doc.file_size && <span className="text-xs text-zinc-600">· {formatBytes(doc.file_size)}</span>}
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
                  title="Ver / descargar"
                >
                  <Eye className="h-4 w-4" />
                </a>
                <button
                  disabled={deletingId === doc.id}
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors disabled:opacity-40"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Empleado</Label>
              <select
                value={form.staff_id}
                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}
                className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Selecciona un empleado</option>
                {activeStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Título del documento</Label>
              <Input
                className="mt-1"
                placeholder="Ej: Contrato indefinido 2024"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="mt-1 flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Archivo (PDF, imagen — máx. 10 MB)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-700 file:text-zinc-200 hover:file:bg-zinc-600 cursor-pointer"
              />
              {file && (
                <p className="text-xs text-zinc-500 mt-1">{file.name} — {formatBytes(file.size)}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_sig"
                checked={form.requires_signature}
                onChange={e => setForm(f => ({ ...f, requires_signature: e.target.checked }))}
                className="rounded border-zinc-700"
              />
              <Label htmlFor="requires_sig" className="cursor-pointer">
                Requiere firma del empleado
              </Label>
            </div>
            {form.requires_signature && (
              <div className="flex items-start gap-2 p-3 bg-amber-950/20 border border-amber-700/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">
                  Se enviará una notificación al empleado para que revise y firme el documento.
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleUpload} disabled={uploading || !file || !form.staff_id || !form.title.trim()}>
                {uploading ? 'Subiendo...' : 'Subir documento'}
              </Button>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

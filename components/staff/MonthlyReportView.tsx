'use client'

import { useState, useEffect } from 'react'
import { format, parseISO, startOfWeek, endOfWeek, differenceInMinutes } from 'date-fns'
import { es } from 'date-fns/locale'
import { Printer, PenLine, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcOvertime, formatOvertime } from '@/lib/overtime'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import SignaturePad from '@/components/sign/SignaturePad'
import dynamic from 'next/dynamic'

const QRSignModal = dynamic(() => import('@/components/sign/QRSignModal'), { ssr: false })

type TimeEntry = {
  id: string
  clock_in: string
  clock_out: string | null
  hours_worked: number | null
  source: string | null
  break_start: string | null
  break_end: string | null
}

type WeekSummary = {
  weekLabel: string
  days: number
  hoursWorked: number
  breakMinutes: number
  hoursContracted: number
  overtime: number
}

type Signature = {
  id?: string
  signed_at: string | null
  status: string
  signature_asset_url?: string | null
} | null

type Props = {
  businessName: string
  staffName: string
  staffDni: string | null
  contractHoursPerWeek: number | null
  year: number
  month: number
  entries: TimeEntry[]
  staffId: string
  businessId: string
  signature: Signature
}

function groupByWeek(entries: TimeEntry[], year: number, month: number, contractHoursPerWeek: number | null): WeekSummary[] {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  // Collect all week starts in the month
  const weekStarts = new Set<string>()
  for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
    const ws = startOfWeek(new Date(d), { weekStartsOn: 1 })
    weekStarts.add(ws.toISOString().slice(0, 10))
  }

  const sorted = Array.from(weekStarts).sort()

  return sorted.map((wsStr) => {
    const ws = parseISO(wsStr)
    const we = endOfWeek(ws, { weekStartsOn: 1 })
    const label = `${format(ws, 'd MMM', { locale: es })} – ${format(we, 'd MMM', { locale: es })}`

    const weekEntries = entries.filter((e) => {
      const d = parseISO(e.clock_in)
      return d >= ws && d <= we
    })

    const hoursWorked = weekEntries.reduce((sum, e) => sum + (e.hours_worked ?? 0), 0)
    const breakMinutes = weekEntries.reduce((sum, e) => {
      if (e.break_start && e.break_end) {
        return sum + differenceInMinutes(parseISO(e.break_end), parseISO(e.break_start))
      }
      return sum
    }, 0)
    const days = weekEntries.length
    const hoursContracted = ((contractHoursPerWeek ?? 0) / 5) * Math.min(days, 5)
    const overtime = calcOvertime(hoursWorked, contractHoursPerWeek ?? 0, Math.min(days, 5))

    return { weekLabel: label, days, hoursWorked, breakMinutes, hoursContracted, overtime }
  })
}

export function MonthlyReportView({
  businessName,
  staffName,
  staffDni,
  contractHoursPerWeek,
  year,
  month,
  entries,
  staffId,
  businessId,
  signature: initialSignature,
}: Props) {
  const [signature, setSignature] = useState<Signature>(initialSignature)
  const [signing, setSigning] = useState(false)
  const [signMsg, setSignMsg] = useState('')
  const [isTouch, setIsTouch] = useState(false)
  const [signatureId, setSignatureId] = useState<string | null>(initialSignature?.id ?? null)
  const [qrOpen, setQrOpen] = useState(false)
  const [touchOpen, setTouchOpen] = useState(false)

  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: es })
  const weeks = groupByWeek(entries, year, month, contractHoursPerWeek)

  const totalHours = entries.reduce((sum, e) => sum + (e.hours_worked ?? 0), 0)
  const totalBreakMin = entries.reduce((sum, e) => {
    if (e.break_start && e.break_end) {
      return sum + differenceInMinutes(parseISO(e.break_end), parseISO(e.break_start))
    }
    return sum
  }, 0)
  const totalContracted = contractHoursPerWeek ? contractHoursPerWeek * 4.33 : 0
  const totalOvertime = contractHoursPerWeek
    ? calcOvertime(totalHours, contractHoursPerWeek, Math.round(30 * (5 / 7)))
    : 0

  /** Creates or retrieves a pending/signed signature request for the time_report */
  const ensureSignatureRequest = async (): Promise<string | null> => {
    if (signatureId) return signatureId
    setSigning(true)
    try {
      const period = `${year}-${String(month).padStart(2, '0')}`
      const res = await fetch('/api/staff/signatures/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          business_id: businessId,
          document_type: 'time_report',
          reference_period: period,
        }),
      })
      const json = await res.json()
      if (res.status === 409) {
        // Already exists — fetch existing
        const sigsRes = await fetch(
          `/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}`
        )
        const sigsJson = await sigsRes.json()
        const found = Array.isArray(sigsJson.data)
          ? sigsJson.data.find(
              (s: { document_type: string; reference_period: string }) =>
                s.document_type === 'time_report' && s.reference_period === period
            )
          : null
        if (found) { setSignatureId(found.id); return found.id }
        throw new Error('No se pudo obtener la solicitud de firma existente')
      }
      if (!res.ok) throw new Error(json.error)
      const id = json.data?.id ?? json.id ?? null
      setSignatureId(id)
      return id
    } catch (e: unknown) {
      setSignMsg((e as Error).message || 'Error al solicitar firma.')
      return null
    } finally {
      setSigning(false)
    }
  }

  const openSignFlow = async () => {
    const id = await ensureSignatureRequest()
    if (!id) return
    if (isTouch) {
      setTouchOpen(true)
    } else {
      setQrOpen(true)
    }
  }

  const handleTouchConfirm = async (blob: Blob) => {
    if (!signatureId) throw new Error('No signature ID')
    const sessionRes = await fetch('/api/sign/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature_id: signatureId }),
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

    setTouchOpen(false)
    setSignMsg('Documento firmado correctamente.')
    // Refresh signature status
    const sigsRes = await fetch(`/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}&signature_id=${signatureId}`)
    const sigsJson = await sigsRes.json()
    const updated = Array.isArray(sigsJson.data)
      ? sigsJson.data.find((s: { id: string }) => s.id === signatureId)
      : null
    if (updated) setSignature(updated)
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-page { padding: 2rem; max-width: 100%; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 6px 10px; font-size: 12px; }
          th { background: #f4f4f4; }
        }
      `}</style>

      <div className="print-page max-w-3xl mx-auto p-6 space-y-6">
        {/* Action buttons */}
        <div className="no-print flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-zinc-100">Resumen mensual de fichajes</h1>
          <div className="flex gap-2">
            {(!signature || signature.status !== 'signed') && (
              <button
                onClick={openSignFlow}
                disabled={signing}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
                  'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700',
                  signing && 'opacity-60 cursor-not-allowed'
                )}
              >
                {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                {isTouch ? 'Firmar ahora' : 'Firmar con móvil (QR)'}
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-[#3B82F6] hover:bg-blue-500 text-white"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {signMsg && (
          <div className="no-print flex items-center gap-2 text-sm text-green-400 bg-green-950/30 border border-green-700/40 rounded-lg px-4 py-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            {signMsg}
          </div>
        )}

        {/* Report header */}
        <div className="border border-zinc-700 rounded-xl p-5 space-y-1 bg-zinc-900 print:border-gray-300 print:bg-white print:rounded-none">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xl font-bold text-zinc-100 print:text-black">{businessName}</p>
              <p className="text-sm text-zinc-400 print:text-gray-600">Registro de jornada laboral</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-400 print:text-gray-600">
                Generado: {format(new Date(), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800 print:border-gray-200 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-zinc-500 print:text-gray-500">Empleado: </span>
              <span className="text-zinc-100 font-medium print:text-black">{staffName}</span>
            </div>
            {staffDni && (
              <div>
                <span className="text-zinc-500 print:text-gray-500">DNI/NIE: </span>
                <span className="text-zinc-100 font-medium print:text-black">{staffDni}</span>
              </div>
            )}
            <div>
              <span className="text-zinc-500 print:text-gray-500">Período: </span>
              <span className="text-zinc-100 font-medium print:text-black capitalize">{monthLabel}</span>
            </div>
            {contractHoursPerWeek && (
              <div>
                <span className="text-zinc-500 print:text-gray-500">Horas contrato: </span>
                <span className="text-zinc-100 font-medium print:text-black">{contractHoursPerWeek} h/semana</span>
              </div>
            )}
          </div>
        </div>

        {/* Weekly summary table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800 print:border-gray-300 print:rounded-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 print:bg-gray-100 border-b border-zinc-800 print:border-gray-300">
                <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Semana</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Días</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Horas trabajadas</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Pausa total</th>
                {contractHoursPerWeek && (
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Horas extra</th>
                )}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.weekLabel} className="border-b border-zinc-800/60 print:border-gray-200 hover:bg-zinc-800/20">
                  <td className="px-4 py-3 text-zinc-300 print:text-black">{week.weekLabel}</td>
                  <td className="px-4 py-3 text-right text-zinc-300 print:text-black">{week.days}</td>
                  <td className="px-4 py-3 text-right font-medium text-zinc-100 print:text-black">{week.hoursWorked.toFixed(2)} h</td>
                  <td className="px-4 py-3 text-right text-zinc-400 print:text-gray-600">
                    {week.breakMinutes > 0 ? `${week.breakMinutes}m` : '—'}
                  </td>
                  {contractHoursPerWeek && (
                    <td className={cn(
                      'px-4 py-3 text-right font-medium',
                      week.overtime > 0.1 ? 'text-green-400' : week.overtime < -0.1 ? 'text-amber-400' : 'text-zinc-500'
                    )}>
                      {formatOvertime(week.overtime)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-zinc-900/80 print:bg-gray-50 border-t-2 border-zinc-700 print:border-gray-400">
                <td className="px-4 py-3 font-semibold text-zinc-200 print:text-black">Total mes</td>
                <td className="px-4 py-3 text-right text-zinc-300 print:text-black">{entries.length}</td>
                <td className="px-4 py-3 text-right font-bold text-zinc-100 print:text-black">{totalHours.toFixed(2)} h</td>
                <td className="px-4 py-3 text-right text-zinc-400 print:text-gray-600">
                  {totalBreakMin > 0 ? `${totalBreakMin}m` : '—'}
                </td>
                {contractHoursPerWeek && (
                  <td className={cn(
                    'px-4 py-3 text-right font-bold',
                    totalOvertime > 0.1 ? 'text-green-400' : totalOvertime < -0.1 ? 'text-amber-400' : 'text-zinc-500'
                  )}>
                    {formatOvertime(totalOvertime)}
                    <span className="text-xs font-normal text-zinc-500 print:text-gray-500 block">
                      (contratado: {totalContracted.toFixed(1)} h)
                    </span>
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Daily detail */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 print:text-gray-600 uppercase tracking-wide mb-3">
            Detalle diario
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800 print:border-gray-300 print:rounded-none">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900 print:bg-gray-100 border-b border-zinc-800 print:border-gray-300">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Entrada</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Salida</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Horas</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Pausa</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 print:text-gray-600 uppercase tracking-wide">Método</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const cin = parseISO(e.clock_in)
                  const cout = e.clock_out ? parseISO(e.clock_out) : null
                  const breakMin = (e.break_start && e.break_end)
                    ? differenceInMinutes(parseISO(e.break_end), parseISO(e.break_start))
                    : null
                  return (
                    <tr key={e.id} className="border-b border-zinc-800/50 print:border-gray-200">
                      <td className="px-4 py-2 text-zinc-300 print:text-black capitalize">
                        {format(cin, "EEEE d MMM", { locale: es })}
                      </td>
                      <td className="px-4 py-2 text-zinc-300 print:text-black">{format(cin, 'HH:mm')}</td>
                      <td className="px-4 py-2 text-zinc-300 print:text-black">
                        {cout ? format(cout, 'HH:mm') : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-zinc-100 print:text-black">
                        {e.hours_worked != null ? `${e.hours_worked.toFixed(2)} h` : '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 print:text-gray-500">
                        {breakMin != null ? `${breakMin}m` : '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-500 print:text-gray-500 capitalize">
                        {e.source ?? 'manual'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature section */}
        <div className="border border-zinc-800 print:border-gray-300 rounded-xl p-5 bg-zinc-900/50 print:bg-white print:rounded-none mt-6">
          <p className="text-sm font-semibold text-zinc-300 print:text-black mb-4">Firma del empleado</p>
          {signature?.status === 'signed' && signature.signed_at ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 print:text-black shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-300 print:text-black">
                    Firmado digitalmente por {staffName}
                  </p>
                  <p className="text-xs text-zinc-500 print:text-gray-500">
                    {format(parseISO(signature.signed_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              {signature.signature_asset_url && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signature.signature_asset_url}
                    alt={`Firma de ${staffName}`}
                    className="max-h-24 border border-zinc-700 print:border-gray-300 rounded-lg bg-white p-1"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-8 mt-4">
              <div>
                <div className="border-b border-zinc-600 print:border-gray-400 h-12 mb-2" />
                <p className="text-xs text-zinc-500 print:text-gray-500">Firma del empleado: {staffName}</p>
              </div>
              <div>
                <div className="border-b border-zinc-600 print:border-gray-400 h-12 mb-2" />
                <p className="text-xs text-zinc-500 print:text-gray-500">Fecha</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR sign modal (desktop) */}
      {signatureId && (
        <QRSignModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          signatureId={signatureId}
          documentLabel={`Informe mensual · ${monthLabel}`}
          onSigned={async () => {
            setQrOpen(false)
            setSignMsg('Documento firmado correctamente.')
            const sigsRes = await fetch(`/api/staff/signatures?business_id=${businessId}&staff_id=${staffId}&signature_id=${signatureId}`)
            const sigsJson = await sigsRes.json()
            const updated = Array.isArray(sigsJson.data)
              ? sigsJson.data.find((s: { id: string }) => s.id === signatureId)
              : null
            if (updated) setSignature(updated)
          }}
        />
      )}

      {/* Touch signature modal (mobile) */}
      <Dialog open={touchOpen} onOpenChange={open => { if (!open) setTouchOpen(false) }}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Firmar informe mensual</DialogTitle>
          </DialogHeader>
          <SignaturePad
            label="Dibuja tu firma con el dedo"
            onConfirm={handleTouchConfirm}
            onCancel={() => setTouchOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

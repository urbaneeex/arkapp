'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw, CheckCircle2 } from 'lucide-react'

interface Props {
  /** Called with the PNG blob once the user confirms */
  onConfirm: (blob: Blob) => Promise<void>
  /** Called when the user cancels (only shown if provided) */
  onCancel?: () => void
  /** Label shown above the canvas */
  label?: string
}

export default function SignaturePad({ onConfirm, onCancel, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  // Keep canvas sized to its display size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setDrawing(true)
    lastPos.current = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.arc(lastPos.current.x, lastPos.current.y, 1, 0, Math.PI * 2)
      ctx.fillStyle = '#1a1a1a'
      ctx.fill()
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    e.preventDefault()
    const pos = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && lastPos.current) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = '#1a1a1a'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
      setHasStrokes(true)
    }
    lastPos.current = pos
  }

  const onPointerUp = () => {
    setDrawing(false)
    lastPos.current = null
  }

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
    setDone(false)
  }, [])

  const confirm = async () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokes) return
    setLoading(true)
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png')
      )
      await onConfirm(blob)
      setDone(true)
    } catch (err) {
      console.error('[SignaturePad] confirm error', err)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <p className="text-lg font-semibold">¡Documento firmado correctamente!</p>
        <p className="text-sm text-muted-foreground">Puedes cerrar esta ventana.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {label && (
        <p className="text-sm text-muted-foreground text-center">{label}</p>
      )}
      <div className="relative rounded-xl border-2 border-dashed border-gray-300 bg-white overflow-hidden touch-none"
           style={{ minHeight: 200 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ minHeight: 200, cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
        {!hasStrokes && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-gray-400 text-sm select-none">Firma aquí</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={clear} disabled={loading || !hasStrokes}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
        <Button type="button" onClick={confirm} disabled={!hasStrokes || loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Guardando...</>
          ) : (
            'Confirmar firma'
          )}
        </Button>
      </div>
    </div>
  )
}

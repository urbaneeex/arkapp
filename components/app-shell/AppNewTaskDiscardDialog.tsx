'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function AppNewTaskDiscardDialog({
  open,
  onCancel,
  onDiscard,
  title = '¿Descartar cambios?',
  description = 'Tienes una tarea sin guardar. Si sales ahora, perderás lo que has escrito.',
  cancelLabel = 'Seguir editando',
  discardLabel = 'Descartar',
}: {
  open: boolean
  onCancel: () => void
  onDiscard: () => void
  title?: string
  description?: string
  cancelLabel?: string
  discardLabel?: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent showClose className="max-w-sm border-zinc-700 bg-zinc-900 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-zinc-400">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            {discardLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

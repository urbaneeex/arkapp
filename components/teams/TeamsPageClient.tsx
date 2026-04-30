'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { TEAM_COLOR_PRESETS, isValidTeamColorHex } from '@/lib/teams/teamColors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type StaffRow = { id: string; name: string }

type ApiTeamMember = {
  id: string
  staff_id: string
  is_lead: boolean
  joined_at: string | null
  staff: { id: string; name: string } | null
}

type ApiTeam = {
  id: string
  name: string
  description: string | null
  color: string
  team_members: ApiTeamMember[] | null
}

export function TeamsPageClient({ staffForPicker }: { staffForPicker: StaffRow[] }) {
  const { hasPermission } = usePermissions()
  const canManage = hasPermission('teams_manage')

  const [teams, setTeams] = useState<ApiTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(TEAM_COLOR_PRESETS[0])
  const [memberLead, setMemberLead] = useState<Record<string, boolean>>({})
  const [memberPick, setMemberPick] = useState<Record<string, boolean>>({})

  const loadTeams = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/teams')
      if (!res.ok) {
        toast.error('No se pudieron cargar los equipos')
        return
      }
      const j = (await res.json()) as { teams?: ApiTeam[] }
      setTeams(j.teams ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  const openCreate = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setColor(TEAM_COLOR_PRESETS[0])
    setMemberLead({})
    setMemberPick({})
    setDialogOpen(true)
  }

  const openEdit = (t: ApiTeam) => {
    setEditingId(t.id)
    setName(t.name)
    setDescription(t.description ?? '')
    setColor(isValidTeamColorHex(t.color) ? t.color : TEAM_COLOR_PRESETS[0])
    const leads: Record<string, boolean> = {}
    const picks: Record<string, boolean> = {}
    for (const m of t.team_members ?? []) {
      picks[m.staff_id] = true
      leads[m.staff_id] = Boolean(m.is_lead)
    }
    setMemberPick(picks)
    setMemberLead(leads)
    setDialogOpen(true)
  }

  const selectedMembersPayload = useMemo(() => {
    const ids = Object.keys(memberPick).filter((id) => memberPick[id])
    return ids.map((staff_id) => ({
      staff_id,
      is_lead: Boolean(memberLead[staff_id]),
    }))
  }, [memberPick, memberLead])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Indica un nombre')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        const res = await fetch(`/api/teams/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmed,
            description: description.trim() || null,
            color,
            members: selectedMembersPayload,
          }),
        })
        if (!res.ok) {
          toast.error(await res.text())
          return
        }
        toast.success('Equipo actualizado')
      } else {
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmed,
            description: description.trim(),
            color,
            members: selectedMembersPayload,
          }),
        })
        if (!res.ok) {
          toast.error(await res.text())
          return
        }
        toast.success('Equipo creado')
      }
      setDialogOpen(false)
      await loadTeams()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, label: string) => {
    if (!canManage) return
    if (!confirm(`¿Eliminar el equipo «${label}»? Las citas ligadas pasarán a visibilidad «Todo el negocio».`)) return
    const res = await fetch(`/api/teams/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error(await res.text())
      return
    }
    toast.success('Equipo eliminado')
    await loadTeams()
  }

  const toggleStaff = (id: string) => {
    setMemberPick((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      if (!next[id]) {
        setMemberLead((l) => {
          const copy = { ...l }
          delete copy[id]
          return copy
        })
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Agrupa personas del negocio para visibilidad «Mi equipo» en el tablero.
        </p>
        {canManage ? (
          <Button type="button" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo equipo
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-12 text-center text-zinc-500">
          No hay equipos todavía.
          {canManage ? (
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={openCreate}>
                Crear el primero
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <li
              key={t.id}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start gap-3">
                <span
                  className="mt-1 h-4 w-4 shrink-0 rounded-full ring-2 ring-zinc-700"
                  style={{ backgroundColor: t.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-zinc-100">{t.name}</h2>
                  {t.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{t.description}</p>
                  ) : null}
                </div>
              </div>
              <p className="mb-3 text-xs text-zinc-500">
                {(t.team_members ?? []).length} miembro(s)
                {(t.team_members ?? []).some((m) => m.is_lead)
                  ? ` · ${(t.team_members ?? []).filter((m) => m.is_lead).length} líder(es)`
                  : ''}
              </p>
              <ul className="mb-4 flex flex-wrap gap-1.5 text-[11px] text-zinc-400">
                {(t.team_members ?? []).slice(0, 8).map((m) => (
                  <li
                    key={m.id}
                    className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-0.5"
                  >
                    {(m.staff?.name ?? '—').trim()}
                    {m.is_lead ? (
                      <span className="ml-1 font-semibold text-brand">· líder</span>
                    ) : null}
                  </li>
                ))}
                {(t.team_members ?? []).length > 8 ? (
                  <li className="text-zinc-600">+{(t.team_members ?? []).length - 8}</li>
                ) : null}
              </ul>
              {canManage ? (
                <div className="mt-auto flex gap-2 border-t border-zinc-800/80 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    onClick={() => void handleDelete(t.id, t.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar equipo' : 'Nuevo equipo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="Nombre del equipo"
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Descripción (opcional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder="Breve descripción"
                className="border-zinc-700 bg-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-zinc-400">Color</span>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className={cn(
                      'h-9 w-9 rounded-full ring-2 transition-transform hover:scale-105',
                      color === c ? 'ring-brand' : 'ring-transparent ring-offset-2 ring-offset-zinc-950'
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-xs font-medium text-zinc-400">Miembros</span>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 p-2">
                {staffForPicker.length === 0 ? (
                  <p className="text-sm text-zinc-500">No hay personas en el negocio.</p>
                ) : (
                  staffForPicker.map((s) => {
                    const on = Boolean(memberPick[s.id])
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-zinc-900/80"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleStaff(s.id)}
                          className="rounded border-zinc-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                        {on ? (
                          <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-500">
                            <input
                              type="checkbox"
                              checked={Boolean(memberLead[s.id])}
                              onChange={() =>
                                setMemberLead((prev) => ({
                                  ...prev,
                                  [s.id]: !prev[s.id],
                                }))
                              }
                              className="rounded border-zinc-600"
                            />
                            Líder
                          </label>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

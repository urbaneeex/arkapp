'use client'

import { useEffect, useState } from 'react'

type MembershipTeam = {
  id: string
  name: string
  description: string | null
  color: string
  is_lead: boolean
  joined_at: string | null
}

/** Solo lectura: equipos del usuario actual (GET /api/teams/memberships). */
export function MyTeamsStrip() {
  const [teams, setTeams] = useState<MembershipTeam[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/teams/memberships')
      .then(async (r) => {
        if (r.status === 403) {
          setTeams([])
          return
        }
        if (!r.ok) {
          const t = await r.text()
          throw new Error(t || 'Error')
        }
        return r.json() as Promise<{ teams?: MembershipTeam[] }>
      })
      .then((d) => {
        if (!cancelled && d) setTeams(d.teams ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar tus equipos.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>
  }
  if (teams === null) {
    return <p className="text-sm text-zinc-500">Cargando equipos…</p>
  }
  if (teams.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No perteneces a ningún equipo en este negocio (o no tienes permiso para verlos).
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {teams.map((t) => (
        <li
          key={t.id}
          className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
        >
          <span
            className="h-3 w-3 shrink-0 rounded-full ring-1 ring-zinc-600"
            style={{ backgroundColor: t.color }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-zinc-100">{t.name}</p>
            {t.description ? (
              <p className="truncate text-xs text-zinc-500">{t.description}</p>
            ) : null}
          </div>
          {t.is_lead ? (
            <span className="shrink-0 rounded bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand">
              Líder
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

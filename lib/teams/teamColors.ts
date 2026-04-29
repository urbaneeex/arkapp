/** Paleta de equipos (Kanban / UI equipos) */
export const TEAM_COLOR_PRESETS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#6b7280',
] as const

export function isValidTeamColorHex(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c)
}

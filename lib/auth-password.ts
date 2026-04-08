export function isValidPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password)
}

export type PasswordRequirement = { id: string; label: string; ok: boolean }

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'len', label: 'Mínimo 8 caracteres', ok: password.length >= 8 },
    { id: 'upper', label: 'Al menos 1 mayúscula', ok: /[A-Z]/.test(password) },
    { id: 'num', label: 'Al menos 1 número', ok: /\d/.test(password) },
  ]
}

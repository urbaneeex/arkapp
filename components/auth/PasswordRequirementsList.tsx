import { getPasswordRequirements } from '@/lib/auth-password'

type Props = {
  password: string
  /** Si es false, no renderiza nada cuando la contraseña está vacía */
  showWhenEmpty?: boolean
}

export function PasswordRequirementsList({ password, showWhenEmpty = false }: Props) {
  if (!showWhenEmpty && password.length === 0) return null
  const requirements = getPasswordRequirements(password)
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {requirements.map((req) => (
        <li key={req.id} className={req.ok ? 'text-emerald-400' : 'text-[#8e8e93]'}>
          {req.ok ? '✓' : '•'} {req.label}
        </li>
      ))}
    </ul>
  )
}

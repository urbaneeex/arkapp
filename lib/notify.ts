import { toast } from 'sonner'

export function notifySuccess(message: string) {
  toast.success(message)
}

export function notifyError(message: string) {
  toast.error(message)
}

export function notifyByType(message: string, type: 'success' | 'error') {
  if (type === 'success') {
    notifySuccess(message)
    return
  }
  notifyError(message)
}

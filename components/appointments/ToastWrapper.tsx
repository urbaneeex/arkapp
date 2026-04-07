'use client'

import { createContext, useContext } from 'react'
import { notifyByType } from '@/lib/notify'

type ToastFn = (message: string, type: 'success' | 'error') => void
const AppointmentToastContext = createContext<ToastFn | null>(null)

export function useAppointmentToast() {
  return useContext(AppointmentToastContext)
}

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  const showToast: ToastFn = (message, type) => notifyByType(message, type)
  return (
    <AppointmentToastContext.Provider value={showToast}>
      {children}
    </AppointmentToastContext.Provider>
  )
}

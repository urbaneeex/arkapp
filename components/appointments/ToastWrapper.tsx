'use client'

import { useState, createContext, useContext } from 'react'
import { ToastSimple } from '@/components/ui/toast-simple'

type ToastFn = (message: string, type: 'success' | 'error') => void
const AppointmentToastContext = createContext<ToastFn | null>(null)

export function useAppointmentToast() {
  return useContext(AppointmentToastContext)
}

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast: ToastFn = (message, type) => setToast({ message, type })
  return (
    <AppointmentToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <ToastSimple
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </AppointmentToastContext.Provider>
  )
}

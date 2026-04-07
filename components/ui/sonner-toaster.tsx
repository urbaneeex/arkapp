'use client'

import { Toaster } from 'sonner'

export function SonnerToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton={false}
      toastOptions={{
        style: {
          background: '#18181b',
          color: '#fafafa',
          border: '1px solid #27272a',
        },
      }}
    />
  )
}

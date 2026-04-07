'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type ToastFeedbackInput = {
  error?: string
  success?: string
}

export function useToastFeedback({ error, success }: ToastFeedbackInput) {
  const lastErrorRef = useRef('')
  const lastSuccessRef = useRef('')

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = ''
      return
    }
    if (error !== lastErrorRef.current) {
      toast.error(error)
      lastErrorRef.current = error
    }
  }, [error])

  useEffect(() => {
    if (!success) {
      lastSuccessRef.current = ''
      return
    }
    if (success !== lastSuccessRef.current) {
      toast.success(success)
      lastSuccessRef.current = success
    }
  }, [success])
}

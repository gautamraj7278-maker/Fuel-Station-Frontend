import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Alert, Snackbar } from '@mui/material'
import { CheckCircle, Error as ErrorIcon, Info, Warning } from '@mui/icons-material'

const TOAST_EVENT = 'fuelstation:toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' })

  const close = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  const show = useCallback((message, severity = 'success') => {
    setToast({ open: true, severity, message: String(message || '') })
  }, [])

  const api = useMemo(
    () => ({
      show,
      showSuccess: (message) => show(message, 'success'),
      showError: (message) => show(message, 'error'),
      showInfo: (message) => show(message, 'info'),
      showWarning: (message) => show(message, 'warning'),
    }),
    [show]
  )

  useEffect(() => {
    const handler = (evt) => {
      const detail = evt?.detail || {}
      const message = detail.message
      const severity = detail.severity
      if (!message) return
      show(message, severity || 'success')
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar open={toast.open} autoHideDuration={3500} onClose={close} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert
          onClose={close}
          severity={toast.severity}
          variant="filled"
          iconMapping={{
            success: <CheckCircle fontSize="inherit" />,
            error: <ErrorIcon fontSize="inherit" />,
            info: <Info fontSize="inherit" />,
            warning: <Warning fontSize="inherit" />,
          }}
          sx={{ minWidth: 320 }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

import axios from 'axios'

const TOAST_EVENT = 'fuelstation:toast'

function shouldSuppressToast(config) {
  const headers = config?.headers || {}
  const value = headers['X-Suppress-Toast'] || headers['x-suppress-toast']
  return String(value || '') === '1'
}

function defaultSuccessMessage(method) {
  const m = String(method || '').toLowerCase()
  if (m === 'post') return 'Saved successfully'
  if (m === 'put' || m === 'patch') return 'Updated successfully'
  if (m === 'delete') return 'Deleted successfully'
  return 'Action successful'
}

function isLoginRequest(config) {
  const url = String(config?.url || '')
  return url.includes('/api/auth/login') || url.includes('/auth/login')
}

const api = axios.create({
  baseURL: 'https://fuel-backend-xfjd.onrender.com',
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle responses
api.interceptors.response.use(
  (response) => {
    try {
      const method = String(response?.config?.method || '').toLowerCase()
      if (['post', 'put', 'patch', 'delete'].includes(method) && !shouldSuppressToast(response.config)) {
        window.dispatchEvent(
          new CustomEvent(TOAST_EVENT, {
            detail: { severity: 'success', message: defaultSuccessMessage(method) },
          })
        )
      }
    } catch {
      // Never break the app due to toast failures
    }
    return response
  },
  (error) => {
    const status = error.response?.status

    // Do not hard-redirect on failed login attempts
    if (status === 401 && !isLoginRequest(error.config)) {
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
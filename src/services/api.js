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

function isAuthRequest(config) {
  const url = String(config?.url || '')

  return (
    url.startsWith('/auth/') ||
    url.includes('/auth/me') ||
    url.includes('/auth/verify') ||
    url.includes('/api/auth/login') ||
    url.includes('/auth/login')
  )
}

function normalizeApiUrl(config) {
  const url = String(config?.url || '')

  // Do not modify full external URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return config
  }

  // Do not modify auth routes
  if (url.startsWith('/auth/')) {
    return config
  }

  // Do not double-prefix routes already starting with /api
  if (url.startsWith('/api/')) {
    return config
  }

  // Prefix all normal backend routes with /api
  if (url.startsWith('/')) {
    config.url = `/api${url}`
  }

  return config
}

const api = axios.create({
  baseURL: 'https://fuel-backend-xfjd.onrender.com',
})

// Add token and normalize API path
api.interceptors.request.use(
  (config) => {
    config = normalizeApiUrl(config)

    const token = localStorage.getItem('token')

    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Handle responses
api.interceptors.response.use(
  (response) => {
    try {
      const method = String(response?.config?.method || '').toLowerCase()

      if (
        ['post', 'put', 'patch', 'delete'].includes(method) &&
        !shouldSuppressToast(response.config)
      ) {
        window.dispatchEvent(
          new CustomEvent(TOAST_EVENT, {
            detail: {
              severity: 'success',
              message: defaultSuccessMessage(method),
            },
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

    if (status === 401 && !isAuthRequest(error.config)) {
      localStorage.removeItem('token')

      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
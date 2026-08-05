import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
export const API_BASE_URL = BASE

export const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ami_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ami_token')
      localStorage.removeItem('ami_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Résout un logoUrl (chemin relatif renvoyé par upload_logo.php, data URI,
// ou URL absolue) vers une URL affichable directement par <img src>.
export function resolveLogoSrc(logoUrl: string | undefined | null): string | null {
  if (!logoUrl) return null
  if (logoUrl.startsWith('data:') || logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl
  }
  return `${API_BASE_URL}/${logoUrl.replace(/^\/+/, '')}`
}

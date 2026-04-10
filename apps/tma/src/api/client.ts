import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'
import { useAppStore } from '../store/useAppStore.js'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2
    }
  }
})

export const apiClient = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? '/api',
  headers: { 'Content-Type': 'application/json' }
})

// Attach JWT on every request
apiClient.interceptors.request.use(config => {
  const token = useAppStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto logout on 401
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAppStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

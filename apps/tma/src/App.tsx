import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAppStore } from './store/useAppStore.js'
import { apiClient } from './api/client.js'
import { useReferralRegister } from './hooks/useReferralRegister.js'
import { Welcome } from './pages/Welcome.js'
import { Onboarding } from './pages/Onboarding.js'
import { Dashboard } from './pages/Dashboard.js'
import { RoastMode } from './pages/RoastMode.js'
import { Subscriptions } from './pages/Subscriptions.js'
import { BNPL } from './pages/BNPL.js'
import { Paywall } from './pages/Paywall.js'
import { Goals } from './pages/Goals.js'
import type { AuthTelegramResponse } from '@klyovo/shared'

export default function App(): JSX.Element {
  const { token, setAuth } = useAppStore()
  useReferralRegister()

  // Auto-auth via Telegram initData on mount
  useEffect(() => {
    if (token) return
    const initData = window.Telegram?.WebApp?.initData
    if (!initData) return

    apiClient
      .post<AuthTelegramResponse>('/auth/telegram', { initData })
      .then(res => {
        setAuth(res.data.token, res.data.user)
      })
      .catch(() => {
        // Stay on welcome/demo screen
      })
  }, [token, setAuth])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/dashboard" replace /> : <Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={token ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="/roast" element={token ? <RoastMode /> : <Navigate to="/" replace />} />
        <Route path="/subscriptions" element={token ? <Subscriptions /> : <Navigate to="/" replace />} />
        <Route path="/bnpl" element={token ? <BNPL /> : <Navigate to="/" replace />} />
        <Route path="/goals" element={token ? <Goals /> : <Navigate to="/" replace />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

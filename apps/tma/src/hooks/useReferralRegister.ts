import { useEffect, useRef } from 'react'
import { apiClient } from '../api/client.js'
import { useAppStore } from '../store/useAppStore.js'

/**
 * Fires POST /referral/register once on mount if TMA was opened with startapp=ref_<code>.
 * Non-fatal: errors are swallowed and do not affect UX.
 */
export function useReferralRegister(): void {
  const { token } = useAppStore()
  const registered = useRef(false)

  useEffect(() => {
    if (registered.current || !token) return

    const startParam =
      (window.Telegram?.WebApp?.initDataUnsafe as { start_param?: string } | undefined)
        ?.start_param ?? ''

    if (!startParam.startsWith('ref_')) return

    const referralCode = startParam.slice(4) // remove "ref_" prefix
    registered.current = true

    apiClient.post('/referral/register', { referralCode }).catch(() => {
      // Non-fatal — attribution failure should not break the app
    })
  }, [token])
}

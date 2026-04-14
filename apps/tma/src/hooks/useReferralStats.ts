import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client.js'
import type { ReferralStatsResponse } from '@klyovo/shared'

export function useReferralStats(): ReturnType<typeof useQuery<ReferralStatsResponse>> {
  return useQuery<ReferralStatsResponse>({
    queryKey: ['referral-stats'],
    queryFn: () =>
      apiClient.get<ReferralStatsResponse>('/referral').then(r => r.data),
    staleTime: 60_000
  })
}

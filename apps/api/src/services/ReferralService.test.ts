import { jest, describe, it, expect, beforeEach } from '@jest/globals'

// ─── Mock @klyovo/db ──────────────────────────────────────────────────────────

const mockUserFindUniqueOrThrow = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserCount = jest.fn()
const mockUserUpdate = jest.fn()

jest.unstable_mockModule('@klyovo/db', () => ({
  prisma: {
    user: {
      findUniqueOrThrow: mockUserFindUniqueOrThrow,
      findUnique: mockUserFindUnique,
      count: mockUserCount,
      update: mockUserUpdate
    }
  }
}))

const { ReferralService } = await import('./ReferralService.js')

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc'
const REFERRAL_CODE = 'abc123xyz0'
const BOT_USERNAME = 'klyovobot'

function makeUser(overrides = {}) {
  return {
    id: USER_ID,
    referralCode: REFERRAL_CODE,
    referredBy: null,
    ...overrides
  }
}

// ─── getReferralStats ─────────────────────────────────────────────────────────

describe('ReferralService.getReferralStats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUniqueOrThrow.mockResolvedValue(makeUser())
    mockUserCount.mockResolvedValueOnce(5).mockResolvedValueOnce(2)
  })

  it('returns referralCode, referralLink, invitedCount, activeCount', async () => {
    const result = await ReferralService.getReferralStats(USER_ID)

    expect(result).toEqual({
      referralCode: REFERRAL_CODE,
      referralLink: `https://t.me/${BOT_USERNAME}?startapp=ref_${REFERRAL_CODE}`,
      invitedCount: 5,
      activeCount: 2
    })
  })

  it('scopes invitedCount to referralCode', async () => {
    await ReferralService.getReferralStats(USER_ID)

    expect(mockUserCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { referredBy: REFERRAL_CODE } })
    )
  })

  it('scopes activeCount to users with at least one transaction', async () => {
    await ReferralService.getReferralStats(USER_ID)

    expect(mockUserCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { referredBy: REFERRAL_CODE, transactions: { some: {} } }
      })
    )
  })

  it('returns 0 counts when no one was referred', async () => {
    mockUserCount.mockReset()
    mockUserCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0)

    const result = await ReferralService.getReferralStats(USER_ID)
    expect(result.invitedCount).toBe(0)
    expect(result.activeCount).toBe(0)
  })
})

// ─── registerReferral ─────────────────────────────────────────────────────────

describe('ReferralService.registerReferral', () => {
  const REFERRER_ID = 'user-ref'
  const INCOMING_CODE = 'refcode12345'

  beforeEach(() => {
    jest.clearAllMocks()
    mockUserFindUniqueOrThrow.mockResolvedValue(makeUser({ referredBy: null }))
    mockUserFindUnique.mockResolvedValue({ id: REFERRER_ID, referralCode: INCOMING_CODE })
    mockUserUpdate.mockResolvedValue({})
  })

  it('writes referredBy when code is valid and user has no referral', async () => {
    await ReferralService.registerReferral(USER_ID, INCOMING_CODE)

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { referredBy: INCOMING_CODE }
    })
  })

  it('is idempotent — does nothing if user already has a referral', async () => {
    mockUserFindUniqueOrThrow.mockResolvedValue(makeUser({ referredBy: 'alreadyset' }))

    await ReferralService.registerReferral(USER_ID, INCOMING_CODE)

    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('throws 404 when referral code not found', async () => {
    mockUserFindUnique.mockResolvedValue(null)

    await expect(
      ReferralService.registerReferral(USER_ID, INCOMING_CODE)
    ).rejects.toMatchObject({ statusCode: 404, code: 'REFERRAL_CODE_NOT_FOUND' })
  })

  it('throws 400 on self-referral', async () => {
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, referralCode: INCOMING_CODE })

    await expect(
      ReferralService.registerReferral(USER_ID, INCOMING_CODE)
    ).rejects.toMatchObject({ statusCode: 400, code: 'SELF_REFERRAL' })
  })

  it('validates code format — rejects uppercase, too short, too long', () => {
    const validCode = /^[a-z0-9]{10,25}$/
    expect(validCode.test('abc123xyz0')).toBe(true)
    expect(validCode.test('ABC123')).toBe(false)
    expect(validCode.test('short')).toBe(false)
    expect(validCode.test('a'.repeat(26))).toBe(false)
  })
})

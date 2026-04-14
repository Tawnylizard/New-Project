import type { Page } from '@playwright/test'

// Injects window.Telegram.WebApp mock before page loads
export async function mockTelegramWebApp(page: Page, initData = ''): Promise<void> {
  await page.addInitScript((data: string) => {
    ;(window as Record<string, unknown>)['Telegram'] = {
      WebApp: {
        initData: data,
        initDataUnsafe: {},
        version: '7.0',
        platform: 'unknown',
        colorScheme: 'light',
        themeParams: {
          bg_color: '#ffffff',
          text_color: '#000000',
          hint_color: '#999999',
          link_color: '#2481cc',
          button_color: '#2481cc',
          button_text_color: '#ffffff',
          secondary_bg_color: '#f1f1f1',
        },
        isExpanded: true,
        viewportHeight: 812,
        viewportStableHeight: 812,
        ready: () => {},
        expand: () => {},
        close: () => {},
        onEvent: () => {},
        offEvent: () => {},
        sendData: () => {},
        openLink: () => {},
        openTelegramLink: () => {},
        showAlert: (_msg: string, cb?: () => void) => cb?.(),
        showConfirm: (_msg: string, cb?: (ok: boolean) => void) => cb?.(true),
        MainButton: {
          text: '',
          color: '#2481cc',
          textColor: '#ffffff',
          isVisible: false,
          isActive: true,
          isProgressVisible: false,
          setText: () => {},
          onClick: () => {},
          offClick: () => {},
          show: () => {},
          hide: () => {},
          enable: () => {},
          disable: () => {},
          showProgress: () => {},
          hideProgress: () => {},
        },
        BackButton: {
          isVisible: false,
          onClick: () => {},
          offClick: () => {},
          show: () => {},
          hide: () => {},
        },
      },
    }
  }, initData)
}

// Mocks a logged-in user by injecting token into localStorage
export async function mockAuthenticatedUser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const authState = {
      state: {
        token: 'mock-jwt-token',
        user: {
          id: 'user-e2e-123',
          displayName: 'Тест Юзер',
          plan: 'FREE',
          planExpiresAt: null,
          referralCode: 'E2ETEST1',
        },
        isLoading: false,
      },
      version: 0,
    }
    localStorage.setItem('klyovo-auth', JSON.stringify(authState))
  })
}

// Intercepts all API calls and returns mock responses
export async function mockApiRoutes(page: Page): Promise<void> {
  await page.route('**/api/**', async route => {
    const url = route.request().url()

    if (url.includes('/auth/telegram')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token',
          user: { id: 'user-e2e-123', displayName: 'Тест Юзер', plan: 'FREE', planExpiresAt: null, referralCode: 'E2ETEST1' },
        }),
      })
    }

    if (url.includes('/analytics/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalKopecks: 3450000,
          transactionCount: 24,
          topCategories: [
            { category: 'FOOD_CAFE', totalKopecks: 1200000, percentage: 35 },
            { category: 'MARKETPLACE', totalKopecks: 900000, percentage: 26 },
            { category: 'TRANSPORT', totalKopecks: 450000, percentage: 13 },
          ],
          changePercent: 12,
          period: 'month',
        }),
      })
    }

    if (url.includes('/transactions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transactions: [] }),
      })
    }

    if (url.includes('/streaks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          importStreak: { current: 3, longest: 7, lastActiveDate: '2026-04-14' },
          spendingStreak: { current: 1, longest: 3, lastComputedWeek: '2026-W15' },
        }),
      })
    }

    // Default: 200 empty
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
}

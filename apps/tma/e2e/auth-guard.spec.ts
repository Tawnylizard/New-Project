import { test, expect } from '@playwright/test'
import { mockTelegramWebApp, mockAuthenticatedUser, mockApiRoutes } from './helpers/telegram-mock.js'

test.describe('Auth guard — unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await mockTelegramWebApp(page)
    await page.addInitScript(() => localStorage.removeItem('klyovo-auth'))
  })

  const protectedRoutes = ['/dashboard', '/roast', '/subscriptions', '/bnpl', '/goals', '/achievements']

  for (const route of protectedRoutes) {
    test(`${route} redirects to /`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL('/')
      await expect(page.getByText('Клёво')).toBeVisible()
    })
  }

  test('unknown route redirects to /', async ({ page }) => {
    await page.goto('/nonexistent-page')
    await expect(page).toHaveURL('/')
  })
})

test.describe('Auth guard — authenticated', () => {
  test.beforeEach(async ({ page }) => {
    await mockTelegramWebApp(page)
    await mockAuthenticatedUser(page)
    await mockApiRoutes(page)
  })

  test('/ redirects authenticated user to /dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/dashboard')
  })

  test('/dashboard is accessible when authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/dashboard')
  })

  test('/paywall is accessible without auth', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('klyovo-auth'))
    await page.goto('/paywall')
    await expect(page).toHaveURL('/paywall')
  })
})

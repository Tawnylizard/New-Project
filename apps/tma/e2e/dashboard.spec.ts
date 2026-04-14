import { test, expect } from '@playwright/test'
import { mockTelegramWebApp, mockAuthenticatedUser, mockApiRoutes } from './helpers/telegram-mock.js'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockTelegramWebApp(page)
    await mockAuthenticatedUser(page)
    await mockApiRoutes(page)
    await page.goto('/dashboard')
  })

  test('shows user display name', async ({ page }) => {
    await expect(page.getByText('Тест Юзер')).toBeVisible()
  })

  test('shows "Жёсткий режим" CTA button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Жёсткий режим/ })).toBeVisible()
  })

  test('shows period selector with 3 options', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Этот мес.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Прошлый' })).toBeVisible()
    await expect(page.getByRole('button', { name: '3 месяца' })).toBeVisible()
  })

  test('shows spending total from API', async ({ page }) => {
    // 3450000 kopecks = ₽34 500 → formatted as "₽35 тыс"
    await expect(page.getByText(/₽\d+\s*тыс/)).toBeVisible()
  })

  test('shows Подписки and BNPL quick nav cards', async ({ page }) => {
    await expect(page.getByText('Подписки')).toBeVisible()
    await expect(page.getByText('BNPL')).toBeVisible()
  })

  test('"Жёсткий режим" navigates to /roast', async ({ page }) => {
    await page.getByRole('button', { name: /Жёсткий режим/ }).click()
    await expect(page).toHaveURL('/roast')
  })

  test('Подписки card navigates to /subscriptions', async ({ page }) => {
    await page.getByText('Подписки').click()
    await expect(page).toHaveURL('/subscriptions')
  })

  test('BNPL card navigates to /bnpl', async ({ page }) => {
    await page.getByText('BNPL').click()
    await expect(page).toHaveURL('/bnpl')
  })

  test('FREE user sees Плюс upgrade button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Плюс' })).toBeVisible()
  })

  test('Плюс button navigates to /paywall', async ({ page }) => {
    await page.getByRole('button', { name: 'Плюс' }).click()
    await expect(page).toHaveURL('/paywall')
  })

  test('period selector switches active period', async ({ page }) => {
    const lastMonthBtn = page.getByRole('button', { name: 'Прошлый' })
    await lastMonthBtn.click()
    // Button should become active (has bg-tg-button class)
    await expect(lastMonthBtn).toHaveClass(/bg-tg-button/)
  })
})

import { test, expect } from '@playwright/test'
import { mockTelegramWebApp } from './helpers/telegram-mock.js'

test.describe('Welcome page', () => {
  test.beforeEach(async ({ page }) => {
    await mockTelegramWebApp(page)
    // Clear auth so we land on Welcome
    await page.addInitScript(() => localStorage.removeItem('klyovo-auth'))
    await page.goto('/')
  })

  test('shows app name and tagline', async ({ page }) => {
    await expect(page.getByText('Клёво')).toBeVisible()
    await expect(page.getByText(/AI-финансист с характером/)).toBeVisible()
  })

  test('shows fire emoji', async ({ page }) => {
    await expect(page.getByText('🔥')).toBeVisible()
  })

  test('has "Попробовать демо" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Попробовать демо' })).toBeVisible()
  })

  test('has "Войти через Telegram" button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible()
  })

  test('demo button shows roast examples', async ({ page }) => {
    await page.getByRole('button', { name: 'Попробовать демо' }).click()

    // Demo roasts are visible
    await expect(page.getByText(/Яндекс Еда/)).toBeVisible()
    await expect(page.getByText(/Wildberries/)).toBeVisible()

    // Disclaimer is shown
    await expect(page.getByText(/информационный сервис/)).toBeVisible()
  })

  test('demo shows CTA to upload CSV', async ({ page }) => {
    await page.getByRole('button', { name: 'Попробовать демо' }).click()
    await expect(page.getByRole('button', { name: /Загрузи свои траты/ })).toBeVisible()
  })

  test('demo CTA navigates to /onboarding', async ({ page }) => {
    await page.getByRole('button', { name: 'Попробовать демо' }).click()
    await page.getByRole('button', { name: /Загрузи свои траты/ }).click()
    await expect(page).toHaveURL('/onboarding')
  })

  test('"Войти через Telegram" navigates to /onboarding', async ({ page }) => {
    await page.getByRole('button', { name: 'Войти через Telegram' }).click()
    await expect(page).toHaveURL('/onboarding')
  })
})

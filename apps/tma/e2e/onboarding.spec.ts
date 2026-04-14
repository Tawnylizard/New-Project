import { test, expect } from '@playwright/test'
import { mockTelegramWebApp } from './helpers/telegram-mock.js'

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockTelegramWebApp(page)
    await page.addInitScript(() => localStorage.removeItem('klyovo-auth'))
    await page.goto('/onboarding')
  })

  test('shows step 1: Привет!', async ({ page }) => {
    await expect(page.getByText('Привет!')).toBeVisible()
    await expect(page.getByText(/личный финансовый ИИ/)).toBeVisible()
  })

  test('step 1 shows legal notices', async ({ page }) => {
    await expect(page.getByText(/ФЗ-152/)).toBeVisible()
    await expect(page.getByText(/информационный сервис/)).toBeVisible()
  })

  test('progress bar has 4 steps', async ({ page }) => {
    // 4 progress bars rendered
    const progressBars = page.locator('.h-1.flex-1.rounded-full')
    await expect(progressBars).toHaveCount(4)
  })

  test('step 1 → step 2 on Далее', async ({ page }) => {
    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText('Как это работает')).toBeVisible()
  })

  test('step 2 shows 3 numbered items', async ({ page }) => {
    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText('Загружаешь выписку из банка')).toBeVisible()
    await expect(page.getByText('AI анализирует твои траты')).toBeVisible()
    await expect(page.getByText(/честный разбор/)).toBeVisible()
  })

  test('step 2 → step 3: Загрузи выписку', async ({ page }) => {
    await page.getByRole('button', { name: 'Далее' }).click()
    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText('Загрузи выписку')).toBeVisible()
    await expect(page.getByText(/Сбер.*Т-Банк/s)).toBeVisible()
  })

  test('step 3 shows bank instructions', async ({ page }) => {
    await page.getByRole('button', { name: 'Далее' }).click()
    await page.getByRole('button', { name: 'Далее' }).click()
    await expect(page.getByText(/Сбер.*История.*Экспорт/s)).toBeVisible()
    await expect(page.getByText(/Т-Банк.*Выписка.*CSV/s)).toBeVisible()
  })

  test('step 3 → step 4: Всё готово!', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Далее' }).click()
    }
    await expect(page.getByText('Всё готово!')).toBeVisible()
  })

  test('step 4 shows Войти через Telegram button', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Далее' }).click()
    }
    await expect(page.getByRole('button', { name: 'Войти через Telegram' })).toBeVisible()
  })
})

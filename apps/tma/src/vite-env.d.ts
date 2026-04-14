/// <reference types="vite/client" />

interface TelegramWebApp {
  initData: string
  initDataUnsafe: Record<string, unknown>
  ready(): void
  expand(): void
  close(): void
  openLink(url: string): void
  openTelegramLink(url: string): void
  onEvent(event: string, handler: () => void): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp
  }
}

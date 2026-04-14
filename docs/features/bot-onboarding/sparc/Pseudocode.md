# Pseudocode: Bot Onboarding

## State Machine

```
States: WELCOME → BANK_SELECT → INSTRUCTIONS → CTA
```

## Core Flow

### /start command

```
FUNCTION handleStart(ctx):
  firstName = ctx.from.first_name ?? "друг"
  startParam = ctx.match

  IF startParam starts with "ref_":
    handleReferral(startParam, ctx.from.id)

  IF startParam starts with "roast_":
    sendRoastDeeplink(ctx, firstName)
    RETURN

  sendWelcome(ctx, firstName)

FUNCTION sendWelcome(ctx, firstName):
  text = """
  Привет, {firstName}! 👋

  Я — Клёво, финансовый ИИ с характером.
  Загрузи выписку из банка — разберу твои траты честно и с юмором.

  С какого банка у тебя карта?
  """
  keyboard = [
    [button("🟢 Сбербанк", callback="bank:sber")],
    [button("🟡 Т-Банк", callback="bank:tbank")],
    [button("🏦 Другой банк", callback="bank:other")]
  ]
  ctx.reply(text, keyboard)
```

### Callback: bank selection

```
FUNCTION handleBankSelect(ctx):
  bank = ctx.callbackQuery.data  // "bank:sber" | "bank:tbank" | "bank:other"
  ctx.answerCallbackQuery()

  SWITCH bank:
    CASE "bank:sber":
      sendSberInstructions(ctx)
    CASE "bank:tbank":
      sendTbankInstructions(ctx)
    CASE "bank:other":
      sendOtherBankMessage(ctx)

FUNCTION sendSberInstructions(ctx):
  text = """
  Как скачать выписку из Сбербанка:

  1. Откройте Сбербанк Онлайн
  2. Выберите карту или счёт
  3. Нажмите «История операций»
  4. Нажмите значок ⬇️ (экспорт) в правом верхнем углу
  5. Выберите формат CSV
  6. Сохраните файл

  Готово! Теперь загрузи файл в Клёво 👇
  """
  keyboard = [[webAppButton("🔥 Открыть Клёво", TMA_URL)]]
  ctx.editMessageText(text, keyboard)

FUNCTION sendTbankInstructions(ctx):
  text = """
  Как скачать выписку из Т-Банка:

  1. Откройте приложение Т-Банк
  2. Перейдите на вкладку «Счета»
  3. Выберите нужную карту
  4. Нажмите «Выписка»
  5. Выберите период и формат Excel (.xlsx)
  6. Сохраните файл

  Готово! Теперь загрузи файл в Клёво 👇
  """
  keyboard = [[webAppButton("🔥 Открыть Клёво", TMA_URL)]]
  ctx.editMessageText(text, keyboard)

FUNCTION sendOtherBankMessage(ctx):
  text = """
  Пока поддерживаем:
  ✅ Сбербанк (CSV)
  ✅ Т-Банк (Excel)

  Скоро добавим Альфа-Банк и ВТБ.

  Если у тебя есть карта Сбера или Т-Банка — загружай выписку оттуда!
  """
  keyboard = [
    [button("🟢 Сбербанк", callback="bank:sber")],
    [button("🟡 Т-Банк", callback="bank:tbank")]
  ]
  ctx.editMessageText(text, keyboard)
```

### /how command

```
FUNCTION handleHow(ctx):
  text = "С какого банка скачать выписку?"
  keyboard = [
    [button("🟢 Сбербанк", callback="bank:sber")],
    [button("🟡 Т-Банк", callback="bank:tbank")]
  ]
  ctx.reply(text, keyboard)
```

### /banks command

```
FUNCTION handleBanks(ctx):
  text = """
  Поддерживаемые банки:

  ✅ Сбербанк — CSV выписка
  ✅ Т-Банк — Excel (.xlsx) выписка
  🔜 Альфа-Банк — скоро
  🔜 ВТБ — скоро
  🔜 Газпромбанк — скоро
  """
  keyboard = [[webAppButton("📊 Открыть Клёво", TMA_URL)]]
  ctx.reply(text, keyboard)
```

## Bot Commands Registration

```
FUNCTION setBotCommands(bot):
  bot.api.setMyCommands([
    { command: "start",  description: "Начать работу с Клёво" },
    { command: "how",    description: "Как скачать выписку из банка" },
    { command: "banks",  description: "Список поддерживаемых банков" },
    { command: "help",   description: "Помощь" }
  ])
```

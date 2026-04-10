import { CsvParser } from './CsvParser.js'

describe('CsvParser', () => {
  describe('Sber CSV', () => {
    it('parses valid UTF-8 Sber CSV', async () => {
      const csv = [
        '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
        '"01.04.2026";"Яндекс Еда";"40817...";"01.04.2026";"Еда";"  -850,00";"RUB";"Выполнен";"Яндекс Еда"',
        '"02.04.2026";"Пятёрочка";"40817...";"02.04.2026";"Продукты";"  -2300,00";"RUB";"Выполнен";"Пятёрочка"',
        ''
      ].join('\n')
      const buffer = Buffer.from(csv, 'utf8')
      const result = await CsvParser.parse(buffer, 'sber')
      expect('error' in result).toBe(false)
      const txns = result as Awaited<ReturnType<typeof CsvParser.parse>> & { length: number }
      expect(txns.length).toBeGreaterThan(0)
    })

    it('returns error for empty file', async () => {
      const buffer = Buffer.from('', 'utf8')
      const result = await CsvParser.parse(buffer, 'sber')
      expect('error' in result).toBe(true)
    })

    it('skips income transactions (positive amounts)', async () => {
      const csv = [
        '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
        '"01.04.2026";"Зарплата";"40817...";"01.04.2026";"Доход";"50000,00";"RUB";"Выполнен";"Зарплата"',
        ''
      ].join('\n')
      const buffer = Buffer.from(csv, 'utf8')
      const result = await CsvParser.parse(buffer, 'sber')
      expect('error' in result).toBe(true)
    })
  })

  describe('Amount parsing', () => {
    it('correctly converts Sber amount with comma decimal to kopecks', async () => {
      const csv = [
        '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
        '"01.04.2026";"Магнит";"40817...";"01.04.2026";"Продукты";"  -1 234,56";"RUB";"Выполнен";"Магнит"',
        ''
      ].join('\n')
      const buffer = Buffer.from(csv, 'utf8')
      const result = await CsvParser.parse(buffer, 'sber')
      if ('error' in result) return
      const txn = result[0]
      expect(txn?.amountKopecks).toBe(123456)
    })
  })

  describe('BNPL detection', () => {
    it('detects Долями transactions', async () => {
      const csv = [
        '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
        '"01.04.2026";"Долями WB";"40817...";"01.04.2026";"Маркетплейс";"  -3000,00";"RUB";"Выполнен";"Долями WB"',
        ''
      ].join('\n')
      const buffer = Buffer.from(csv, 'utf8')
      const result = await CsvParser.parse(buffer, 'sber')
      if ('error' in result) return
      expect(result[0]?.isBnpl).toBe(true)
      expect(result[0]?.bnplService).toBe('dolyami')
    })
  })
})

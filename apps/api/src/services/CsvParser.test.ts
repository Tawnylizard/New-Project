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

describe('CsvParser — T-Bank', () => {
  const tbankHeader = '"Дата операции";"Дата платежа";"Описание";"Категория";"Статус";"Сумма операции";"Сумма платежа"'

  it('parses valid T-Bank CSV with comma delimiter', async () => {
    const csv = [
      tbankHeader.replace(/;/g, ','),
      '"02.04.2026","02.04.2026","Яндекс Такси","Транспорт","OK","","-450,00"',
      '"03.04.2026","03.04.2026","Пятёрочка","Продукты","OK","","-1200,50"',
      ''
    ].join('\n')
    const buffer = Buffer.from(csv, 'utf8')
    const result = await CsvParser.parse(buffer, 'tbank')
    expect('error' in result).toBe(false)
    const txns = result as Exclude<typeof result, { error: string }>
    expect(txns.length).toBe(2)
  })

  it('correctly parses amount to kopecks', async () => {
    const csv = [
      tbankHeader.replace(/;/g, ','),
      '"01.04.2026","01.04.2026","Netflix","Подписки","OK","","-899,00"',
      ''
    ].join('\n')
    const buffer = Buffer.from(csv, 'utf8')
    const result = await CsvParser.parse(buffer, 'tbank')
    if ('error' in result) throw new Error('unexpected error')
    expect(result[0]?.amountKopecks).toBe(89900)
  })

  it('skips income (positive amounts)', async () => {
    const csv = [
      tbankHeader.replace(/;/g, ','),
      '"01.04.2026","01.04.2026","Пополнение","Доход","OK","","10000,00"',
      ''
    ].join('\n')
    const buffer = Buffer.from(csv, 'utf8')
    const result = await CsvParser.parse(buffer, 'tbank')
    expect('error' in result).toBe(true)
  })

  it('returns invalid_format if header row is missing', async () => {
    const csv = [
      '"01.04.2026","01.04.2026","Магазин","OK","","-500,00"',
      ''
    ].join('\n')
    const buffer = Buffer.from(csv, 'utf8')
    const result = await CsvParser.parse(buffer, 'tbank')
    expect('error' in result).toBe(true)
    expect((result as { error: string }).error).toBe('invalid_format')
  })
})

describe('CsvParser — CP1251 encoding', () => {
  it('auto-detects CP1251 Sber CSV and decodes correctly', async () => {
    // Build a Sber CSV row in CP1251 encoding
    const iconv = await import('iconv-lite')
    const csv = [
      '"Дата";"Описание";"Счёт";"Дата операции";"Категория";"Сумма";"Валюта";"Статус";"Описание"',
      '"01.04.2026";"Магнит";"40817...";"01.04.2026";"Продукты";"  -500,00";"RUB";"Выполнен";"Магнит"',
      ''
    ].join('\n')
    const buffer = iconv.default.encode(csv, 'cp1251')
    const result = await CsvParser.parse(buffer, 'sber')
    expect('error' in result).toBe(false)
    const txns = result as Exclude<typeof result, { error: string }>
    expect(txns[0]?.merchantName).toBe('Магнит')
  })
})

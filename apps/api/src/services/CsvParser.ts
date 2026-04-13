import iconv from 'iconv-lite'
import { Categorizer } from './Categorizer.js'
import type { TransactionCategory } from '@klyovo/shared'

export interface ParsedTransaction {
  amountKopecks: number
  merchantName: string
  merchantNormalized: string
  category: TransactionCategory
  transactionDate: Date
  rawDescription: string | null
  isBnpl: boolean
  bnplService: string | null
}

export interface ParseError {
  error: string
}

const BNPL_PATTERNS = [
  { pattern: /долям[иы]/iu, service: 'dolyami' },
  { pattern: /dolami/i, service: 'dolyami' },
  { pattern: /tinkoff\s*split/i, service: 'split' },
  { pattern: /сплит/i, service: 'split' },
  { pattern: /подел[иь]/iu, service: 'podeli' },
  { pattern: /podeli/i, service: 'podeli' },
  { pattern: /\bbnpl\b/i, service: 'split' }
]

function detectBNPL(merchantName: string): { isBnpl: boolean; bnplService: string | null } {
  for (const { pattern, service } of BNPL_PATTERNS) {
    if (pattern.test(merchantName)) {
      return { isBnpl: true, bnplService: service }
    }
  }
  return { isBnpl: false, bnplService: null }
}

function parseDate(dateStr: string): Date | null {
  // dd.mm.yyyy
  const dmyMatch = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(dateStr)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
  }
  // yyyy-mm-dd
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (isoMatch) {
    return new Date(`${dateStr.slice(0, 10)}T00:00:00.000Z`)
  }
  return null
}

function parseAmount(amountStr: string): number | null {
  // Remove spaces, replace comma with dot
  const cleaned = amountStr.replace(/\s/g, '').replace(',', '.')
  const value = parseFloat(cleaned)
  if (isNaN(value)) return null
  return Math.round(Math.abs(value) * 100)
}

function splitQuotedRow(row: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function decodeBuffer(buffer: Buffer): string {
  try {
    const utf8 = iconv.decode(buffer, 'utf8')
    // Check for replacement characters indicating failed decode
    if (!utf8.includes('\uFFFD')) return utf8
  } catch {
    // fall through to CP1251
  }
  return iconv.decode(buffer, 'cp1251')
}

function parseSber(rows: string[]): ParsedTransaction[] | ParseError {
  const transactions: ParsedTransaction[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.trim()) continue

    const cols = row.split(';').map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length < 9) continue

    const dateStr = cols[0] ?? ''
    const amountStr = cols[5] ?? ''
    const desc = cols[8] ?? ''

    if (!amountStr || !dateStr) continue

    // Skip income (positive amounts in Sber)
    const raw = amountStr.replace(/\s/g, '').replace(',', '.')
    const floatVal = parseFloat(raw)
    if (isNaN(floatVal) || floatVal > 0) continue

    const date = parseDate(dateStr)
    if (!date) continue

    const amountKopecks = parseAmount(amountStr)
    if (!amountKopecks || amountKopecks === 0) continue

    const merchantName = desc.trim()
    const merchantNormalized = merchantName.toLowerCase()
    const category = Categorizer.categorize(merchantName)
    const bnpl = detectBNPL(merchantName)

    transactions.push({
      amountKopecks,
      merchantName,
      merchantNormalized,
      category,
      transactionDate: date,
      rawDescription: desc,
      ...bnpl
    })
  }

  if (transactions.length === 0) return { error: 'empty_file' }
  return transactions
}

function parseTbank(rows: string[]): ParsedTransaction[] | ParseError {
  const transactions: ParsedTransaction[] = []

  // Find header row (may be quoted)
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i] ?? '').replace(/^"/, '').startsWith('Дата операции')) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return { error: 'invalid_format' }

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.trim()) continue

    const cols = splitQuotedRow(row, ',')
    if (cols.length < 7) continue

    const dateStr = cols[0] ?? ''
    const desc = cols[2] ?? ''
    const amountStr = cols[6] ?? ''

    if (!amountStr || !dateStr) continue

    const raw = amountStr.replace(/\s/g, '').replace(',', '.')
    const floatVal = parseFloat(raw)
    if (isNaN(floatVal) || floatVal > 0) continue

    const date = parseDate(dateStr)
    if (!date) continue

    const amountKopecks = parseAmount(amountStr)
    if (!amountKopecks || amountKopecks === 0) continue

    const merchantName = desc.trim()
    const merchantNormalized = merchantName.toLowerCase()
    const category = Categorizer.categorize(merchantName)
    const bnpl = detectBNPL(merchantName)

    transactions.push({
      amountKopecks,
      merchantName,
      merchantNormalized,
      category,
      transactionDate: date,
      rawDescription: desc,
      ...bnpl
    })
  }

  if (transactions.length === 0) return { error: 'empty_file' }
  return transactions
}

export class CsvParser {
  static async parse(
    fileBuffer: Buffer,
    bankType: 'sber' | 'tbank'
  ): Promise<ParsedTransaction[] | ParseError> {
    const content = decodeBuffer(fileBuffer)
    const rows = content.split('\n')

    if (rows.length < 2) return { error: 'empty_file' }

    return bankType === 'sber' ? parseSber(rows) : parseTbank(rows)
  }
}

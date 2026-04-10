import type { TransactionCategory } from '@klyovo/shared'

// Note: \w does NOT match Cyrillic — use explicit Unicode ranges or literals
const KEYWORD_MAP: Array<[TransactionCategory, string[]]> = [
  [
    'MARKETPLACE',
    ['wildberries', 'wb', 'ozon', 'яндекс маркет', 'aliexpress', 'ali express', 'market.yandex']
  ],
  [
    'FOOD_CAFE',
    [
      'kfc', 'mcdonald', 'бургер', 'пицца', 'яндекс еда', 'delivery club', 'вкусвилл',
      'самокат', 'сберфуд', 'яндекс.еда', 'burger', 'pizza', 'sushi', 'суши'
    ]
  ],
  [
    'TRANSPORT',
    [
      'яндекс такси', 'яндекс go', 'uber', 'whoosh', 'urent', 'метро',
      'мцд', 'мтк', 'аэроэкспресс', 'ситимобил', 'русские автобусы'
    ]
  ],
  [
    'SUBSCRIPTIONS',
    [
      'netflix', 'spotify', 'яндекс плюс', 'vk музыка', 'telegram premium',
      'apple music', 'google one', 'microsoft 365', 'amediateka', 'okko',
      'иви', 'кинопоиск', 'more.tv'
    ]
  ],
  [
    'HEALTH',
    [
      'аптека', 'apteka', 'сбер здоровье', 'eapteka', '36.6', 'ригла',
      'живика', 'медси', 'дмс', 'инвитро', 'гемотест'
    ]
  ],
  [
    'GROCERIES',
    [
      'пятёрочка', '5ka', 'пятерочка', 'магнит', 'перекрёсток', 'перекресток',
      'лента', 'ашан', 'ashan', 'metro', 'бристоль', 'красное & белое', 'светофор'
    ]
  ],
  [
    'ENTERTAINMENT',
    [
      'кино', 'cinema', 'театр', 'museum', 'музей', 'escape', 'квест',
      'боулинг', 'bowling', 'бар', 'ресторан', 'hookah'
    ]
  ],
  [
    'CLOTHING',
    [
      'zara', 'h&m', 'uniqlo', 'befree', 'gloria jeans',
      'concept club', 'твое', 'lime', 'sarafan'
    ]
  ],
  [
    'EDUCATION',
    [
      'skillfactory', 'skillbox', 'яндекс практикум', 'coursera', 'stepik',
      'geekbrains', 'учёба', 'образование', 'школа'
    ]
  ]
]

export class Categorizer {
  static categorize(merchantName: string): TransactionCategory {
    const normalized = merchantName.toLowerCase().trim()

    for (const [category, keywords] of KEYWORD_MAP) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          return category
        }
      }
    }

    return 'OTHER'
  }
}

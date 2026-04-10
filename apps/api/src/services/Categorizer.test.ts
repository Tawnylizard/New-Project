import { Categorizer } from './Categorizer.js'

describe('Categorizer', () => {
  it('categorizes marketplace merchants', () => {
    expect(Categorizer.categorize('Wildberries')).toBe('MARKETPLACE')
    expect(Categorizer.categorize('OZON')).toBe('MARKETPLACE')
    expect(Categorizer.categorize('Яндекс Маркет')).toBe('MARKETPLACE')
  })

  it('categorizes food merchants', () => {
    expect(Categorizer.categorize('KFC')).toBe('FOOD_CAFE')
    expect(Categorizer.categorize('Яндекс Еда')).toBe('FOOD_CAFE')
    expect(Categorizer.categorize('Вкусвилл')).toBe('FOOD_CAFE')
  })

  it('categorizes transport', () => {
    expect(Categorizer.categorize('Яндекс Такси')).toBe('TRANSPORT')
    expect(Categorizer.categorize('Whoosh')).toBe('TRANSPORT')
  })

  it('categorizes subscriptions', () => {
    expect(Categorizer.categorize('Netflix')).toBe('SUBSCRIPTIONS')
    expect(Categorizer.categorize('Яндекс Плюс')).toBe('SUBSCRIPTIONS')
  })

  it('categorizes groceries', () => {
    expect(Categorizer.categorize('Пятёрочка')).toBe('GROCERIES')
    expect(Categorizer.categorize('Магнит')).toBe('GROCERIES')
  })

  it('returns OTHER for unknown merchant', () => {
    expect(Categorizer.categorize('Неизвестная компания XYZ')).toBe('OTHER')
  })
})

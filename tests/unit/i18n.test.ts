import { describe, it, expect } from 'vitest'
import { t, translations } from '@/lib/i18n'

describe('i18n t()', () => {
  it('returns English strings', () => {
    expect(t('en', 'nav.discover')).toBe('Discover')
  })

  it('returns Bangla strings', () => {
    expect(t('bn', 'nav.discover')).toBe('\u0986\u09ac\u09bf\u09b7\u09cd\u0995\u09be\u09b0')
  })

  it('falls back to English when a key is missing in Bangla', () => {
    const key = 'test.english-only'
    translations.en[key] = 'English fallback'
    try { expect(t('bn', key)).toBe('English fallback') }
    finally { delete translations.en[key] }

  })

  it('falls back to the key itself for unknown keys', () => {
    expect(t('en', 'no.such.key')).toBe('no.such.key')
  })
  it('translates visible workflow phrases without changing API identifiers', () => {
    expect(t('bn', 'Add Evidence')).toMatch(/[\u0980-\u09FF]/)
    expect(t('bn', 'Save')).toMatch(/[\u0980-\u09FF]/)
    expect(t('en', 'Add Evidence')).toBe('Add Evidence')
    expect(t('bn', 'api:write')).toBe('api:write')
  })
})

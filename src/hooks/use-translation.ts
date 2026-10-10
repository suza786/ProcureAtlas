'use client'
import { useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { t as translate } from '@/lib/i18n'
import { formatDate, formatDateTime } from '@/lib/format'
export function useTranslation() {
  const locale = useAppStore(state => state.locale)
  const timeZone = useAppStore(state => state.timeZone)
  const t = useCallback((key: string) => translate(locale, key), [locale])
  return { locale, timeZone, t,
    formatDate: (date: Parameters<typeof formatDate>[0]) => formatDate(date, { locale, timeZone }),
    formatDateTime: (date: Parameters<typeof formatDateTime>[0]) => formatDateTime(date, { locale, timeZone }),
  }
}

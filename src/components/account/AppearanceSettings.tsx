'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from '@/hooks/use-translation'
import { Palette } from 'lucide-react'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export function AppearanceSettings() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  // Match the server markup before reading the browser's saved preference.
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)

  return <section id="appearance-settings" aria-labelledby="appearance-heading" className="rounded-lg border border-border bg-card p-4">
    <h2 id="appearance-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Palette className="h-4 w-4" aria-hidden="true" />{t('appearance.title')}
    </h2>
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <label htmlFor="appearance-theme" className="text-sm font-medium text-foreground">{t('appearance.theme')}</label>
        <p id="appearance-help" className="mt-1 text-xs text-muted-foreground">{t('appearance.help')}</p>
      </div>
      <select id="appearance-theme" aria-describedby="appearance-help" disabled={!mounted} value={mounted ? theme ?? 'light' : 'light'} onChange={event => setTheme(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <option value="light">{t('appearance.light')}</option>
        <option value="dark">{t('appearance.dark')}</option>
        <option value="system">{t('appearance.system')}</option>
      </select>
    </div>
  </section>
}

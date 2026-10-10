import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindUrlNavigation, useAppStore } from '@/lib/store'

afterEach(() => { vi.unstubAllGlobals() })

describe('navigation history integration', () => {
  it('updates the document language for screen readers when the locale changes', () => {
    const documentElement = { lang: 'en' }
    vi.stubGlobal('document', { documentElement })
    useAppStore.getState().setLocale('bn')
    expect(documentElement.lang).toBe('bn')
    useAppStore.getState().setLocale('en')
    expect(documentElement.lang).toBe('en')
  })
  it('fails safely when a caller supplies a missing detail ID', () => {
    useAppStore.getState().openTender(undefined as unknown as string)
    expect(useAppStore.getState().view).toEqual({ type: 'command' })
  })
  it('pushes each new destination once and restores Back/Forward without loops', () => {
    let url = new URL('http://localhost/?view=discover&market=BD')
    const listeners = new Map<string, () => void>()
    const pushes: string[] = []
    vi.stubGlobal('window', {
      get location() { return url },
      history: { state: { next: true }, pushState: (_state: unknown, _title: string, target: string) => { pushes.push(target); url = new URL(target, url) } },
      localStorage: { getItem: () => null },
      addEventListener: (event: string, callback: () => void) => listeners.set(event, callback),
      removeEventListener: (event: string) => listeners.delete(event),
    })
    const cleanup = bindUrlNavigation()
    expect(useAppStore.getState().view).toEqual({ type: 'discover' })
    useAppStore.getState().openTender('t1')
    useAppStore.getState().openTender('t1')
    expect(pushes).toHaveLength(1)
    url = new URL('http://localhost/?view=discover&market=BD')
    listeners.get('popstate')?.()
    expect(useAppStore.getState().view).toEqual({ type: 'discover' })
    expect(useAppStore.getState().discoverFilters.market).toBe('BD')
    expect(pushes).toHaveLength(1)
    cleanup()
    expect(listeners.size).toBe(0)
  })
  it('does not replace the current time zone with an invalid value', () => {
    useAppStore.getState().setTimeZone('Asia/Dhaka')
    useAppStore.getState().setTimeZone('invalid-zone')
    expect(useAppStore.getState().timeZone).toBe('Asia/Dhaka')
  })
})

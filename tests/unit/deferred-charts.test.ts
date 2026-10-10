import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { watchChartVisibility } from '@/components/charts/chart-visibility'

describe('deferred chart boundary', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
  it('does not start loading until near the viewport and disconnects after activation', () => {
    let notify!: IntersectionObserverCallback
    const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback }
      observe = vi.fn()
      disconnect = disconnect
    })
    const activate = vi.fn()
    const stop = watchChartVisibility({} as Element, activate)
    expect(activate).not.toHaveBeenCalled()
    notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(activate).not.toHaveBeenCalled()
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(activate).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()
    stop()
    notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(activate).toHaveBeenCalledTimes(1)
  })
  it('defers its fallback until after the first render and cancels on unmount', () => {
    vi.useFakeTimers(); vi.stubGlobal('IntersectionObserver', undefined)
    const activate = vi.fn()
    const stop = watchChartVisibility({} as Element, activate)
    expect(activate).not.toHaveBeenCalled()
    stop(); vi.runAllTimers()
    expect(activate).not.toHaveBeenCalled()
    watchChartVisibility({} as Element, activate)
    vi.runAllTimers()
    expect(activate).toHaveBeenCalledTimes(1)
  })
  it('keeps Recharts out of view imports and loads complete panels dynamically', () => {
    for (const name of ['CommandCenter', 'Analytics', 'AwardIntel', 'CompetitorIntel']) {
      const source = readFileSync(`src/components/views/${name}.tsx`, 'utf8')
      expect(source).not.toMatch(/from ['"]recharts['"]/)
      expect(source).toContain('@/components/charts/deferred-charts')
    }
    const boundary = readFileSync('src/components/charts/deferred-charts.tsx', 'utf8')
    expect(boundary).toContain("import('./chart-panels')")
    expect(boundary).toContain('ssr: false')
    expect(boundary).not.toMatch(/import (?!type).*from ['"]\.\/chart-panels['"]/)
  })
})

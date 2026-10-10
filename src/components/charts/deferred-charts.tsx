'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { watchChartVisibility } from './chart-visibility'
import type { BarChartPanelProps, DonutChartPanelProps, LineChartPanelProps } from './chart-panels'

function ChartLoading() {
  const { t } = useTranslation()
  return <div role="status" className="flex h-full w-full items-center justify-center rounded bg-slate-50 text-xs text-slate-500">{t('common.loading')}</div>
}
const LazyBar = dynamic(() => import('./chart-panels').then(module => module.BarChartPanel), { ssr: false, loading: ChartLoading })
const LazyDonut = dynamic(() => import('./chart-panels').then(module => module.DonutChartPanel), { ssr: false, loading: ChartLoading })
const LazyLine = dynamic(() => import('./chart-panels').then(module => module.LineChartPanel), { ssr: false, loading: ChartLoading })

function ChartViewport({ label, children }: { label: string; children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!viewport.current) return
    return watchChartVisibility(viewport.current, () => setVisible(true))
  }, [])
  return <div ref={viewport} role="group" aria-label={label} aria-busy={!visible} className="h-full w-full">
    {visible ? children : <ChartLoading />}
  </div>
}
export function DeferredBarChart({ label, ...props }: BarChartPanelProps & { label: string }) {
  return <ChartViewport label={label}><LazyBar {...props} /></ChartViewport>
}
export function DeferredDonutChart({ label, ...props }: DonutChartPanelProps & { label: string }) {
  return <ChartViewport label={label}><LazyDonut {...props} /></ChartViewport>
}
export function DeferredLineChart({ label, ...props }: LineChartPanelProps & { label: string }) {
  return <ChartViewport label={label}><LazyLine {...props} /></ChartViewport>
}

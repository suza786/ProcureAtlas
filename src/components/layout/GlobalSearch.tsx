'use client'
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { apiFetch, apiErrorMessage } from '@/lib/api-client'
import { parseSearchResults, searchResultView, type SearchResult } from '@/lib/global-search'
import { useAppStore } from '@/lib/store'
import { useTranslation } from '@/hooks/use-translation'

export function GlobalSearch() {
  const { t } = useTranslation()
  const auth = useAppStore(state => state.auth)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [active, setActive] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const trimmed = query.trim()
  useEffect(() => {
    setQuery(''); setResults([]); setError(null); setLoading(false); setActive(-1); setOpen(false)
  }, [auth])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus(); setOpen(true) }
    }
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('keydown', shortcut)
    window.addEventListener('pointerdown', outside)
    return () => { window.removeEventListener('keydown', shortcut); window.removeEventListener('pointerdown', outside) }
  }, [])
  useEffect(() => {
    if (trimmed.length < 2 || !open) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(null)
      try {
        const response = await apiFetch('/api/search?q=' + encodeURIComponent(trimmed) + '&types=tender,buyer,supplier,award,company,pursuit&limit=12', { signal: controller.signal })
        const payload: unknown = await response.json()
        if (!controller.signal.aborted) { setResults(parseSearchResults(payload)); setActive(-1) }
      } catch (cause) {
        if (!controller.signal.aborted) { setError(apiErrorMessage(cause)); setResults([]) }
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [trimmed, retry, open, auth])
  const select = (result: SearchResult) => {
    const view = searchResultView(result)
    if (!view) return
    setOpen(false); setQuery(''); setResults([])
    useAppStore.getState().setView(view)
  }
  return <div ref={container} className="relative min-w-0 flex-1 md:flex-none md:w-72">
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5">
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input ref={input} role="combobox" aria-label={t('search.placeholder')} aria-expanded={open} aria-controls="global-search-results" aria-autocomplete="list" aria-activedescendant={active >= 0 && open ? 'search-result-' + active : undefined}
        value={query} placeholder={t('search.placeholder')} maxLength={500} onFocus={() => setOpen(true)}
        onBlur={(event) => { if (!container.current?.contains(event.relatedTarget as Node)) setOpen(false) }}
        onChange={(event) => { setQuery(event.target.value); setResults([]); setActive(-1); setError(null); setLoading(event.target.value.trim().length >= 2); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') { setOpen(false); setActive(-1) }
          if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive(i => (i + 1) % results.length); setOpen(true) }
          if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive(i => (i <= 0 ? results.length - 1 : i - 1)) }
          if (event.key === 'Enter' && active >= 0 && results[active]) { event.preventDefault(); select(results[active]) }
        }} className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      <kbd className="hidden shrink-0 text-[10px] text-muted-foreground md:block">Ctrl K</kbd>
    </div>
    {open && <div className="fixed inset-x-3 top-16 z-40 max-h-96 overflow-auto rounded-md border border-border bg-card shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:w-[28rem]">
      <div role="status" className="px-3 py-2 text-xs text-muted-foreground">{trimmed.length < 2 ? t('search.minLength') : error ? t('search.error') : loading ? t('common.loading') : results.length ? t('search.results') : t('search.empty')}</div>
      {error && <div className="px-3 pb-3 text-sm text-rose-700 dark:text-rose-300"><p>{error}</p><button className="mt-2 underline" onClick={() => setRetry(n => n + 1)}>{t('search.retry')}</button></div>}
      <ul id="global-search-results" role="listbox" aria-label={t('search.results')}>
        {!loading && !error && results.map((result, index) => <li key={result.type + ':' + result.id} role="option" id={'search-result-' + index} aria-selected={active === index}>
          <button type="button" onClick={() => select(result)} className={'w-full px-3 py-3 text-left hover:bg-muted focus:bg-muted ' + (active === index ? 'bg-muted' : '')}>
            <span className="block text-sm font-medium text-foreground">{result.title}</span><span className="block text-xs text-muted-foreground">{t('search.type.' + result.type)} · {result.subtitle}</span>
          </button>
        </li>)}
      </ul>
    </div>}
  </div>
}

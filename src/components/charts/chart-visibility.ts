/** Activate once near the viewport; no-observer browsers get the next-tick
 * fallback, leaving initial metrics free to render first. */
export function watchChartVisibility(element: Element, activate: () => void) {
  let active = true
  let observer: IntersectionObserver | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const start = () => {
    if (!active) return
    active = false
    observer?.disconnect()
    activate()
  }
  if (typeof IntersectionObserver === 'undefined') timer = setTimeout(start, 0)
  else {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) start()
    }, { rootMargin: '200px', threshold: 0 })
    observer.observe(element)
  }
  return () => { active = false; observer?.disconnect(); clearTimeout(timer) }
}

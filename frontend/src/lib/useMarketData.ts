import { useCallback, useEffect, useState } from "react"
import { api } from "./api"

const isVisible = () => document.visibilityState !== "hidden"

// One request at a time per resource. Abort on asset/range changes, pause in
// background tabs, and retain (visibly stale) data only for the same resource.
export function useMarketData<T>(path: string, interval: number) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string; loading: boolean }>({ path, loading: true })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt(n => n + 1), [])
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let running = false
    setState(previous => previous.path === path ? previous : { path, loading: true })
    async function load() {
      if (!active || running || !isVisible()) return
      running = true
      let failed = false
      controller = new AbortController()
      setState(previous => ({ ...(previous.path === path ? previous : { path }), loading: true }))
      try {
        const data = await api.get<T>(path, controller.signal)
        if (active) setState({ path, data, loading: false })
      } catch (error) {
        failed = true
        if (active && !controller.signal.aborted) setState(previous => ({
          ...previous, loading: false,
          error: error instanceof Error ? error.message : "Market data is unavailable.",
        }))
      } finally {
        running = false
        if (active && isVisible()) timer = setTimeout(load, failed ? Math.min(interval, 20_000) : interval)
      }
    }
    function visibilityChanged() {
      clearTimeout(timer)
      if (isVisible()) void load()
    }
    document.addEventListener("visibilitychange", visibilityChanged)
    void load()
    return () => {
      active = false
      controller?.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", visibilityChanged)
    }
  }, [path, interval, attempt])
  return { ...(state.path === path ? state : { path, loading: true }), retry }
}

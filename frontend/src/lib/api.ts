// Thin fetch wrapper for the Django API.
//
// All requests are same-origin (Vite proxies /api to Django), so cookies flow
// automatically. For unsafe methods we read the csrftoken cookie and echo it
// back in the X-CSRFToken header, which is what Django's CSRF check requires.

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return match ? decodeURIComponent(match[2]) : null
}



async function ensureCsrf(): Promise<void> {
  if (getCookie("csrftoken")) return
  const response = await fetch("/api/auth/csrf/", { credentials: "include" })
  if (!response.ok) throw new ApiError(response.status, "Cannot connect securely. Please retry.", null)
}

type Json = Record<string, unknown> | undefined

async function request<T>(method: string, path: string, body?: Json): Promise<T> {
  const unsafe = method !== "GET" && method !== "HEAD"
  if (unsafe) await ensureCsrf()

  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  if (unsafe) {
    const token = getCookie("csrftoken")
    if (token) headers["X-CSRFToken"] = token
  }

  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : undefined } catch {
    throw new ApiError(res.status, "The server is unavailable or returned an unexpected response. Please retry.", null)
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || firstError(data))) || `Request failed (${res.status})`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

function firstError(data: Record<string, unknown>): string | null {
  for (const key of Object.keys(data)) {
    const val = data[key]
    if (Array.isArray(val) && val.length) {
      for (const item of val) {
        const message = typeof item === "string" ? item : item && typeof item === "object" ? firstError(item) : null
        if (message) return `${key}: ${message}`
      }
    }
    if (typeof val === "string") return `${key}: ${val}`
    if (val && typeof val === "object") {
      const message = firstError(val as Record<string, unknown>)
      if (message) return `${key}: ${message}`
    }
  }
  return null
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: Json) => request<T>("POST", path, body),
  patch: <T,>(path: string, body?: Json) => request<T>("PATCH", path, body),
  del: <T,>(path: string, body?: Json) => request<T>("DELETE", path, body),
}

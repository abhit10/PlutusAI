import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { api, ApiError } from "./api"
import type { User } from "./types"

interface AuthContextValue {
  user: User | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Bootstrap the session on first load.
    api
      .get<User>("/auth/me/")
      .then(setUser)
      .catch((err) => {
        if (!(err instanceof ApiError && [401, 403].includes(err.status))) {
          setError("Could not check your session. Check that the backend is running and retry.")
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const u = await api.post<User>("/auth/login/", { email, password })
    setUser(u)
  }

  async function signup(email: string, password: string, name: string) {
    const u = await api.post<User>("/auth/signup/", { email, password, name })
    setUser(u)
  }

  async function logout() {
    await api.post("/auth/logout/")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

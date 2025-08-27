'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { parseAuthToken, clearAuthToken } from '@/lib/auth-client'

interface AuthContextType {
  isLoggedIn: boolean
  token: string | null
  signOut: () => void
}

const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  token: null,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const authToken = parseAuthToken()
    if (authToken) {
      setToken(authToken)
      setIsLoggedIn(true)
    }
  }, [])

  const signOut = () => {
    clearAuthToken()
    setToken(null)
    setIsLoggedIn(false)
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, token, signOut }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

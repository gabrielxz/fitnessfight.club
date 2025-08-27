'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getCurrentUser } from '@/lib/auth'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  refreshUser: () => Promise<void>
}

interface AuthUser {
  username: string
  email?: string
  cognitoId: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser()

      if (currentUser) {
        setUser({
          username: currentUser.username,
          cognitoId: currentUser.cognitoId,
          email: currentUser.email,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkUser()

    const handleTokenChange = () => {
      checkUser()
    }

    window.addEventListener('fitnessfight_auth_tokens', handleTokenChange)

    return () => {
      window.removeEventListener('fitnessfight_auth_tokens', handleTokenChange)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: checkUser }}>
      {children}
    </AuthContext.Provider>
  )
}

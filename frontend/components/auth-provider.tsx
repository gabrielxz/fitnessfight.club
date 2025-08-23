'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'
import '@/lib/amplify-config'

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
      const session = await fetchAuthSession()

      setUser({
        username: currentUser.username,
        cognitoId: currentUser.userId,
        email: session.tokens?.idToken?.payload?.email as string | undefined,
      })
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkUser()

    // Listen for auth events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
        case 'tokenRefresh':
          checkUser()
          break
        case 'signedOut':
          setUser(null)
          break
        default:
          break
      }
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: checkUser }}>
      {children}
    </AuthContext.Provider>
  )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseAuthToken } from '@/lib/auth-client'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Parse token from URL and store it
    const token = parseAuthToken()
    if (token) {
      // Redirect to home page after successful auth
      router.push('/')
    } else {
      // Handle error
      router.push('/?error=auth_failed')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
        <p className="text-muted-foreground">Please wait while we complete your sign in.</p>
      </div>
    </div>
  )
}

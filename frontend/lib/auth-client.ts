'use client'

// Simple client-side auth helper for Cognito hosted UI
export function getCognitoAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'
  const cognitoDomain = `fitnessfight-club-${environment}.auth.us-east-1.amazoncognito.com`

  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:3000/auth/callback'

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
  })

  return `https://${cognitoDomain}/login?${params.toString()}`
}

export function getCognitoSignOutUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'
  const cognitoDomain = `fitnessfight-club-${environment}.auth.us-east-1.amazoncognito.com`

  const logoutUri = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  })

  return `https://${cognitoDomain}/logout?${params.toString()}`
}

export function parseAuthToken(): string | null {
  if (typeof window === 'undefined') return null

  // Check for token in URL hash (implicit flow)
  const hash = window.location.hash
  if (hash) {
    const params = new URLSearchParams(hash.substring(1))
    const idToken = params.get('id_token')
    if (idToken) {
      localStorage.setItem('auth_token', idToken)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
      return idToken
    }
  }

  // Check localStorage
  return localStorage.getItem('auth_token')
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
  }
}

export function isAuthenticated(): boolean {
  return !!parseAuthToken()
}

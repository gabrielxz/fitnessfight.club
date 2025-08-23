import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'

const REGION = 'us-east-1'
const USER_POOL_ID = process.env.NEXT_PUBLIC_USER_POOL_ID
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID

if (!USER_POOL_ID || !CLIENT_ID) {
  console.warn('Cognito configuration missing. Authentication features will not work.')
}

// Create Cognito client
export const cognitoClient = new CognitoIdentityProviderClient({
  region: REGION,
})

// Store tokens in memory (you might want to use localStorage or cookies in production)
const TOKEN_STORAGE_KEY = 'fitnessfight_auth_tokens'

interface AuthTokens {
  AccessToken?: string
  IdToken?: string
  RefreshToken?: string
}

export function getAuthTokens(): AuthTokens {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (err) {
    console.error('Error reading auth tokens:', err)
  }

  return {}
}

export function setAuthTokens(tokens: AuthTokens) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
  } catch (err) {
    console.error('Error storing auth tokens:', err)
  }
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch (err) {
    console.error('Error clearing auth tokens:', err)
  }
}

export { USER_POOL_ID, CLIENT_ID }

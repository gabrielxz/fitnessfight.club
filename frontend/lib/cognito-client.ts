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
let authTokens: {
  AccessToken?: string
  IdToken?: string
  RefreshToken?: string
} = {}

export function getAuthTokens() {
  return authTokens
}

export function setAuthTokens(tokens: typeof authTokens) {
  authTokens = tokens
}

export function clearAuthTokens() {
  authTokens = {}
}

export { USER_POOL_ID, CLIENT_ID }

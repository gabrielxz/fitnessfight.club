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

export { USER_POOL_ID, CLIENT_ID }

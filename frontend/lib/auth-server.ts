import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { createServerRunner } from '@aws-amplify/adapter-nextjs'
import { cookies } from 'next/headers'

const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID
const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID

// Only throw error in production, not during tests
if (!userPoolId || !userPoolClientId) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Missing required Cognito configuration. Please set NEXT_PUBLIC_USER_POOL_ID and NEXT_PUBLIC_USER_POOL_CLIENT_ID environment variables.'
    )
  }
  // Use dummy values for tests
  const testPoolId = 'test-pool-id'
  const testClientId = 'test-client-id'
  Object.assign(process.env, {
    NEXT_PUBLIC_USER_POOL_ID: process.env.NEXT_PUBLIC_USER_POOL_ID || testPoolId,
    NEXT_PUBLIC_USER_POOL_CLIENT_ID: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || testClientId,
  })
}

const { runWithAmplifyServerContext } = createServerRunner({
  config: {
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID || 'test-pool-id',
        userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || 'test-client-id',
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
        },
      },
    },
  },
})

export interface AuthUser {
  userId: string
  username: string
  email?: string
  cognitoId: string
}

// Server-side auth functions
export async function getCurrentUserServer(): Promise<AuthUser | null> {
  try {
    const currentUser = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async () => {
        try {
          const user = await getCurrentUser()
          const session = await fetchAuthSession()

          return {
            userId: user.username,
            username: user.username,
            cognitoId: user.userId,
            email: session.tokens?.idToken?.payload?.email as string | undefined,
          }
        } catch {
          return null
        }
      },
    })

    return currentUser
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

export async function getAuthTokenServer(): Promise<string | null> {
  try {
    const token = await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async () => {
        try {
          const session = await fetchAuthSession()
          return session.tokens?.idToken?.toString() || null
        } catch {
          return null
        }
      },
    })

    return token
  } catch (error) {
    console.error('Get auth token error:', error)
    return null
  }
}

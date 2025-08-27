import {
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { cognitoClient, CLIENT_ID } from './cognito-client'

export interface AuthUser {
  userId: string
  username: string
  email?: string
  cognitoId: string
}

export interface SignUpParams {
  email: string
  password: string
  fullName?: string // Make optional for now
}

// Client-side auth functions
export async function signUp({ email, password }: SignUpParams): Promise<{
  success: boolean
  isSignUpComplete?: boolean
  userId?: string
  nextStep?: { signUpStep: string }
  error?: string
}> {
  try {
    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        // Note: fullName can be stored in user profile later if needed
      ],
    })

    const response = await cognitoClient.send(command)

    return {
      success: true,
      isSignUpComplete: response.UserConfirmed || false,
      userId: response.UserSub,
      nextStep: response.UserConfirmed ? undefined : { signUpStep: 'CONFIRM_SIGN_UP' },
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred during sign up'
    console.error('Sign up error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function confirmSignUpCode(
  email: string,
  code: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    })

    await cognitoClient.send(command)
    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Invalid or expired confirmation code'
    console.error('Confirm sign up error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function resendConfirmationCode(email: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: email,
    })

    await cognitoClient.send(command)
    return { success: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to resend confirmation code'
    console.error('Resend confirmation code error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function requestPasswordReset(email: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const command = new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
    })

    await cognitoClient.send(command)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to request password reset'
    console.error('Request password reset error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    })

    await cognitoClient.send(command)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to reset password'
    console.error('Confirm password reset error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
    return { success: true }
  } catch (error) {
    console.error('Sign out error:', error)
    return { success: false, error: 'Failed to sign out' }
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/user`, {
      credentials: 'include',
    })
    if (!response.ok) {
      return null
    }
    const user = await response.json()

    const emailAttr = user.UserAttributes?.find(
      (attr: { Name: string; Value: string }) => attr.Name === 'email'
    )
    const subAttr = user.UserAttributes?.find(
      (attr: { Name: string; Value: string }) => attr.Name === 'sub'
    )

    if (!user.Username || !subAttr?.Value) {
      return null
    }

    return {
      userId: user.Username,
      username: user.Username,
      email: emailAttr?.Value,
      cognitoId: subAttr.Value,
    }
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

export async function federatedSignIn(provider: 'Google'): Promise<void> {
  // Validate provider
  if (provider !== 'Google') {
    throw new Error(`Unsupported provider: ${provider}`)
  }

  // Ensure CLIENT_ID is available
  if (!CLIENT_ID) {
    throw new Error('Authentication not configured. Please check your environment variables.')
  }

  // Get environment from env variable or default to dev
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'dev'

  // Construct Cognito domain
  const cognitoDomain = `fitnessfight-club-${environment}`
  const region = 'us-east-1'

  // The redirect URI must point to our backend endpoint
  const redirectUri = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google/callback`

  // Construct the Cognito Hosted UI URL
  const cognitoUrl = new URL(
    `https://${cognitoDomain}.auth.${region}.amazoncognito.com/oauth2/authorize`
  )

  cognitoUrl.searchParams.append('identity_provider', provider)
  cognitoUrl.searchParams.append('response_type', 'code') // Use authorization code flow
  cognitoUrl.searchParams.append('client_id', CLIENT_ID)
  cognitoUrl.searchParams.append('redirect_uri', redirectUri)
  cognitoUrl.searchParams.append('scope', 'email openid profile')

  // Generate state for CSRF protection
  const state = btoa(
    JSON.stringify({
      provider,
      timestamp: Date.now(),
      origin: window.location.href,
    })
  )
  cognitoUrl.searchParams.append('state', state)

  // Redirect to Cognito Hosted UI with Google provider
  window.location.href = cognitoUrl.toString()
}

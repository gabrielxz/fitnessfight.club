import {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  ResendConfirmationCodeCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider'
import {
  cognitoClient,
  CLIENT_ID,
  getAuthTokens,
  setAuthTokens,
  clearAuthTokens,
} from './cognito-client'

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

export interface SignInParams {
  email: string
  password: string
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

export async function signIn({ email, password }: SignInParams): Promise<{
  success: boolean
  isSignedIn?: boolean
  nextStep?: { signInStep: string }
  error?: string
}> {
  try {
    const command = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })

    const response = await cognitoClient.send(command)

    if (response.ChallengeName) {
      // Handle MFA or other challenges if needed
      return {
        success: false,
        isSignedIn: false,
        nextStep: { signInStep: response.ChallengeName },
      }
    }

    if (response.AuthenticationResult) {
      // Store tokens
      setAuthTokens({
        AccessToken: response.AuthenticationResult.AccessToken,
        IdToken: response.AuthenticationResult.IdToken,
        RefreshToken: response.AuthenticationResult.RefreshToken,
      })

      return {
        success: true,
        isSignedIn: true,
      }
    }

    return {
      success: false,
      error: 'Sign in failed',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid email or password'
    console.error('Sign in error:', errorMessage)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export async function signOut(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const tokens = getAuthTokens()
    if (tokens.AccessToken) {
      const command = new GlobalSignOutCommand({
        AccessToken: tokens.AccessToken,
      })
      await cognitoClient.send(command)
    }
    clearAuthTokens()
    return { success: true }
  } catch (error) {
    console.error('Sign out error:', error instanceof Error ? error.message : error)
    // Clear tokens even if sign out fails
    clearAuthTokens()
    return { success: true }
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

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const tokens = getAuthTokens()
    if (!tokens.AccessToken) {
      return null
    }

    const command = new GetUserCommand({
      AccessToken: tokens.AccessToken,
    })

    const response = await cognitoClient.send(command)

    const emailAttr = response.UserAttributes?.find((attr) => attr.Name === 'email')
    const subAttr = response.UserAttributes?.find((attr) => attr.Name === 'sub')

    if (!response.Username || !subAttr?.Value) {
      return null
    }

    return {
      userId: response.Username,
      username: response.Username,
      email: emailAttr?.Value,
      cognitoId: subAttr.Value,
    }
  } catch (error) {
    console.error('Get current user error:', error)
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

  // Determine redirect URI based on current location
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/signin`
      : environment === 'prod'
        ? 'https://fitnessfight.club/signin'
        : 'https://dev.fitnessfight.club/signin'

  // Construct the Cognito Hosted UI URL with Google as identity provider
  const cognitoUrl = new URL(
    `https://${cognitoDomain}.auth.${region}.amazoncognito.com/oauth2/authorize`
  )

  // Add OAuth parameters for authorization code flow with implicit fallback
  cognitoUrl.searchParams.append('identity_provider', provider)
  cognitoUrl.searchParams.append('response_type', 'token') // Using implicit flow for simpler frontend-only auth
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

import {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  ResendConfirmationCodeCommand,
  AuthFlowType,
  ChallengeNameType,
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
  fullName: string
}

export interface SignInParams {
  email: string
  password: string
}

// Client-side auth functions
export async function signUp({ email, password, fullName }: SignUpParams): Promise<{
  success: boolean
  isSignUpComplete?: boolean
  userId?: string
  nextStep?: { signUpStep: string }
  error?: string
}> {
  console.log('signUp function called with:', { email, fullName, password: '***' })
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
        {
          Name: 'name',
          Value: fullName,
        },
      ],
    })

    const response = await cognitoClient.send(command)
    console.log('Cognito signUp success:', response)

    return {
      success: true,
      isSignUpComplete: response.UserConfirmed || false,
      userId: response.UserSub,
      nextStep: response.UserConfirmed ? undefined : { signUpStep: 'CONFIRM_SIGN_UP' },
    }
  } catch (error: any) {
    console.error('Sign up error:', error)
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during sign up',
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
  } catch (error: any) {
    console.error('Sign in error:', error)
    return {
      success: false,
      error: error.message || 'Invalid email or password',
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
  } catch (error: any) {
    console.error('Sign out error:', error)
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
  } catch (error: any) {
    console.error('Confirm sign up error:', error)
    return {
      success: false,
      error: error.message || 'Invalid or expired confirmation code',
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
  } catch (error: any) {
    console.error('Resend confirmation code error:', error)
    return {
      success: false,
      error: error.message || 'Failed to resend confirmation code',
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
  } catch (error: any) {
    console.error('Request password reset error:', error)
    return {
      success: false,
      error: error.message || 'Failed to request password reset',
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
  } catch (error: any) {
    console.error('Confirm password reset error:', error)
    return {
      success: false,
      error: error.message || 'Failed to reset password',
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

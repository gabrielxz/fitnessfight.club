import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  AuthError,
} from 'aws-amplify/auth'
import './amplify-config'

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
  try {
    const { isSignUpComplete, userId, nextStep } = await amplifySignUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name: fullName,
        },
      },
    })

    return {
      success: true,
      isSignUpComplete,
      userId,
      nextStep,
    }
  } catch (error) {
    console.error('Sign up error:', error)
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred during sign up',
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
    const { isSignedIn, nextStep } = await amplifySignIn({
      username: email,
      password,
    })

    return {
      success: true,
      isSignedIn,
      nextStep,
    }
  } catch (error) {
    console.error('Sign in error:', error)
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred during sign in',
    }
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    await amplifySignOut()
    return { success: true }
  } catch (error) {
    console.error('Sign out error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred during sign out',
    }
  }
}

export async function confirmSignUpCode(
  username: string,
  code: string
): Promise<{
  success: boolean
  isSignUpComplete?: boolean
  nextStep?: { signUpStep: string }
  error?: string
}> {
  try {
    const { isSignUpComplete, nextStep } = await confirmSignUp({
      username,
      confirmationCode: code,
    })

    return {
      success: true,
      isSignUpComplete,
      nextStep,
    }
  } catch (error) {
    console.error('Confirm sign up error:', error)
    if (error instanceof AuthError) {
      return {
        success: false,
        error: error.message,
      }
    }
    return {
      success: false,
      error: 'An unexpected error occurred during confirmation',
    }
  }
}

export async function resendConfirmationCode(
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await resendSignUpCode({ username })
    return { success: true }
  } catch (error) {
    console.error('Resend code error:', error)
    return {
      success: false,
      error: 'Failed to resend confirmation code',
    }
  }
}

export async function requestPasswordReset(
  username: string
): Promise<{ success: boolean; nextStep?: { resetPasswordStep: string }; error?: string }> {
  try {
    const { nextStep } = await resetPassword({ username })
    return {
      success: true,
      nextStep,
    }
  } catch (error) {
    console.error('Password reset request error:', error)
    return {
      success: false,
      error: 'Failed to request password reset',
    }
  }
}

export async function confirmPasswordReset(
  username: string,
  confirmationCode: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await confirmResetPassword({
      username,
      confirmationCode,
      newPassword,
    })
    return { success: true }
  } catch (error) {
    console.error('Password reset confirmation error:', error)
    return {
      success: false,
      error: 'Failed to reset password',
    }
  }
}

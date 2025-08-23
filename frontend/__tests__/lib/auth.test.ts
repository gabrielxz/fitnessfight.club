import {
  signUp,
  signIn,
  signOut,
  confirmSignUpCode,
  resendConfirmationCode,
  requestPasswordReset,
  confirmPasswordReset,
} from '@/lib/auth'
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

// Mock Amplify auth module
jest.mock('aws-amplify/auth', () => ({
  ...jest.requireActual('aws-amplify/auth'),
  AuthError: class AuthError extends Error {
    constructor({ name, message }: { name: string; message: string }) {
      super(message)
      this.name = name
    }
  },
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  confirmSignUp: jest.fn(),
  resendSignUpCode: jest.fn(),
  resetPassword: jest.fn(),
  confirmResetPassword: jest.fn(),
}))
jest.mock('@/lib/amplify-config', () => ({}))

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('signUp', () => {
    it('should successfully sign up a user', async () => {
      const mockResponse = {
        isSignUpComplete: false,
        userId: 'test-user-id',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      }
      ;(amplifySignUp as jest.Mock).mockResolvedValue(mockResponse)

      const result = await signUp({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })

      expect(amplifySignUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'TestPass123!',
        options: {
          userAttributes: {
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      })

      expect(result).toEqual({
        success: true,
        isSignUpComplete: false,
        userId: 'test-user-id',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })
    })

    it('should handle sign up error', async () => {
      const mockError = new AuthError({
        name: 'UsernameExistsException',
        message: 'Username already exists',
      })
      ;(amplifySignUp as jest.Mock).mockRejectedValue(mockError)

      const result = await signUp({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })

      expect(result).toEqual({
        success: false,
        error: 'Username already exists',
      })
    })

    it('should handle unexpected errors', async () => {
      ;(amplifySignUp as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await signUp({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred during sign up',
      })
    })
  })

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const mockResponse = {
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      }
      ;(amplifySignIn as jest.Mock).mockResolvedValue(mockResponse)

      const result = await signIn({
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(amplifySignIn).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(result).toEqual({
        success: true,
        isSignedIn: true,
        nextStep: { signInStep: 'DONE' },
      })
    })

    it('should handle sign in error', async () => {
      const mockError = new AuthError({
        name: 'NotAuthorizedException',
        message: 'Incorrect username or password',
      })
      ;(amplifySignIn as jest.Mock).mockRejectedValue(mockError)

      const result = await signIn({
        email: 'test@example.com',
        password: 'WrongPass',
      })

      expect(result).toEqual({
        success: false,
        error: 'Incorrect username or password',
      })
    })

    it('should handle unexpected sign in errors', async () => {
      ;(amplifySignIn as jest.Mock).mockRejectedValue(new Error('Connection failed'))

      const result = await signIn({
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred during sign in',
      })
    })
  })

  describe('signOut', () => {
    it('should successfully sign out a user', async () => {
      ;(amplifySignOut as jest.Mock).mockResolvedValue(undefined)

      const result = await signOut()

      expect(amplifySignOut).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('should handle sign out error', async () => {
      ;(amplifySignOut as jest.Mock).mockRejectedValue(new Error('Sign out failed'))

      const result = await signOut()

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred during sign out',
      })
    })
  })

  describe('confirmSignUpCode', () => {
    it('should successfully confirm sign up code', async () => {
      const mockResponse = {
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      }
      ;(confirmSignUp as jest.Mock).mockResolvedValue(mockResponse)

      const result = await confirmSignUpCode('test@example.com', '123456')

      expect(confirmSignUp).toHaveBeenCalledWith({
        username: 'test@example.com',
        confirmationCode: '123456',
      })

      expect(result).toEqual({
        success: true,
        isSignUpComplete: true,
        nextStep: { signUpStep: 'DONE' },
      })
    })

    it('should handle invalid confirmation code', async () => {
      const mockError = new AuthError({
        name: 'CodeMismatchException',
        message: 'Invalid verification code provided',
      })
      ;(confirmSignUp as jest.Mock).mockRejectedValue(mockError)

      const result = await confirmSignUpCode('test@example.com', '000000')

      expect(result).toEqual({
        success: false,
        error: 'Invalid verification code provided',
      })
    })

    it('should handle unexpected confirmation errors', async () => {
      ;(confirmSignUp as jest.Mock).mockRejectedValue(new Error('Unexpected error'))

      const result = await confirmSignUpCode('test@example.com', '123456')

      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred during confirmation',
      })
    })
  })

  describe('resendConfirmationCode', () => {
    it('should successfully resend confirmation code', async () => {
      ;(resendSignUpCode as jest.Mock).mockResolvedValue({ deliveryMedium: 'EMAIL' })

      const result = await resendConfirmationCode('test@example.com')

      expect(resendSignUpCode).toHaveBeenCalledWith({
        username: 'test@example.com',
      })

      expect(result).toEqual({ success: true })
    })

    it('should handle resend code error', async () => {
      ;(resendSignUpCode as jest.Mock).mockRejectedValue(new Error('Failed to resend'))

      const result = await resendConfirmationCode('test@example.com')

      expect(result).toEqual({
        success: false,
        error: 'Failed to resend confirmation code',
      })
    })
  })

  describe('requestPasswordReset', () => {
    it('should successfully request password reset', async () => {
      const mockResponse = {
        nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' },
      }
      ;(resetPassword as jest.Mock).mockResolvedValue(mockResponse)

      const result = await requestPasswordReset('test@example.com')

      expect(resetPassword).toHaveBeenCalledWith({
        username: 'test@example.com',
      })

      expect(result).toEqual({
        success: true,
        nextStep: { resetPasswordStep: 'CONFIRM_RESET_PASSWORD_WITH_CODE' },
      })
    })

    it('should handle password reset request error', async () => {
      ;(resetPassword as jest.Mock).mockRejectedValue(new Error('User not found'))

      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({
        success: false,
        error: 'Failed to request password reset',
      })
    })
  })

  describe('confirmPasswordReset', () => {
    it('should successfully confirm password reset', async () => {
      ;(confirmResetPassword as jest.Mock).mockResolvedValue(undefined)

      const result = await confirmPasswordReset('test@example.com', '123456', 'NewPass123!')

      expect(confirmResetPassword).toHaveBeenCalledWith({
        username: 'test@example.com',
        confirmationCode: '123456',
        newPassword: 'NewPass123!',
      })

      expect(result).toEqual({ success: true })
    })

    it('should handle password reset confirmation error', async () => {
      ;(confirmResetPassword as jest.Mock).mockRejectedValue(new Error('Invalid code'))

      const result = await confirmPasswordReset('test@example.com', '000000', 'NewPass123!')

      expect(result).toEqual({
        success: false,
        error: 'Failed to reset password',
      })
    })
  })
})

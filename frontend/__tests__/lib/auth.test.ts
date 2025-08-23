import {
  signUp,
  signIn,
  signOut,
  confirmSignUpCode,
  resendConfirmationCode,
  requestPasswordReset,
  confirmPasswordReset,
} from '@/lib/auth'
import { cognitoClient } from '@/lib/cognito-client'

// Mock the Cognito client
jest.mock('@/lib/cognito-client', () => ({
  cognitoClient: {
    send: jest.fn(),
  },
  CLIENT_ID: 'test-client-id',
  getAuthTokens: jest.fn(),
  setAuthTokens: jest.fn(),
  clearAuthTokens: jest.fn(),
}))

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('signUp', () => {
    it('should successfully sign up a new user', async () => {
      const mockResponse = {
        UserConfirmed: false,
        UserSub: 'user-123',
      }
      ;(cognitoClient.send as jest.Mock).mockResolvedValue(mockResponse)

      const result = await signUp({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })

      expect(result).toEqual({
        success: true,
        isSignUpComplete: false,
        userId: 'user-123',
        nextStep: { signUpStep: 'CONFIRM_SIGN_UP' },
      })
      expect(cognitoClient.send).toHaveBeenCalled()
    })

    it('should handle sign up errors', async () => {
      const error = new Error('User already exists')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await signUp({
        email: 'test@example.com',
        password: 'TestPass123!',
        fullName: 'Test User',
      })

      expect(result).toEqual({
        success: false,
        error: 'User already exists',
      })
    })
  })

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: 'access-token',
          IdToken: 'id-token',
          RefreshToken: 'refresh-token',
        },
      }
      ;(cognitoClient.send as jest.Mock).mockResolvedValue(mockResponse)

      const result = await signIn({
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(result).toEqual({
        success: true,
        isSignedIn: true,
      })
    })

    it('should handle sign in errors', async () => {
      const error = new Error('Incorrect username or password')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await signIn({
        email: 'test@example.com',
        password: 'WrongPass',
      })

      expect(result).toEqual({
        success: false,
        error: 'Incorrect username or password',
      })
    })

    it('should handle MFA challenge', async () => {
      const mockResponse = {
        ChallengeName: 'SMS_MFA',
      }
      ;(cognitoClient.send as jest.Mock).mockResolvedValue(mockResponse)

      const result = await signIn({
        email: 'test@example.com',
        password: 'TestPass123!',
      })

      expect(result).toEqual({
        success: false,
        isSignedIn: false,
        nextStep: { signInStep: 'SMS_MFA' },
      })
    })
  })

  describe('signOut', () => {
    it('should successfully sign out a user', async () => {
      ;(cognitoClient.send as jest.Mock).mockResolvedValue({})

      const result = await signOut()

      expect(result).toEqual({
        success: true,
      })
    })

    it('should handle sign out errors gracefully', async () => {
      const error = new Error('Network error')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await signOut()

      expect(result).toEqual({
        success: true, // Still returns success even on error
      })
    })
  })

  describe('confirmSignUpCode', () => {
    it('should successfully confirm sign up', async () => {
      ;(cognitoClient.send as jest.Mock).mockResolvedValue({})

      const result = await confirmSignUpCode('test@example.com', '123456')

      expect(result).toEqual({
        success: true,
      })
    })

    it('should handle confirmation errors', async () => {
      const error = new Error('Invalid verification code')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await confirmSignUpCode('test@example.com', '123456')

      expect(result).toEqual({
        success: false,
        error: 'Invalid verification code',
      })
    })
  })

  describe('resendConfirmationCode', () => {
    it('should successfully resend confirmation code', async () => {
      ;(cognitoClient.send as jest.Mock).mockResolvedValue({})

      const result = await resendConfirmationCode('test@example.com')

      expect(result).toEqual({
        success: true,
      })
    })

    it('should handle resend errors', async () => {
      const error = new Error('User not found')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await resendConfirmationCode('test@example.com')

      expect(result).toEqual({
        success: false,
        error: 'User not found',
      })
    })
  })

  describe('requestPasswordReset', () => {
    it('should successfully request password reset', async () => {
      ;(cognitoClient.send as jest.Mock).mockResolvedValue({})

      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({
        success: true,
      })
    })

    it('should handle request errors', async () => {
      const error = new Error('User not found')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await requestPasswordReset('test@example.com')

      expect(result).toEqual({
        success: false,
        error: 'User not found',
      })
    })
  })

  describe('confirmPasswordReset', () => {
    it('should successfully confirm password reset', async () => {
      ;(cognitoClient.send as jest.Mock).mockResolvedValue({})

      const result = await confirmPasswordReset('test@example.com', '123456', 'NewPass123!')

      expect(result).toEqual({
        success: true,
      })
    })

    it('should handle confirmation errors', async () => {
      const error = new Error('Invalid verification code')
      ;(cognitoClient.send as jest.Mock).mockRejectedValue(error)

      const result = await confirmPasswordReset('test@example.com', '123456', 'NewPass123!')

      expect(result).toEqual({
        success: false,
        error: 'Invalid verification code',
      })
    })
  })
})

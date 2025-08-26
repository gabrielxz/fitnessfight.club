import {
  signUp,
  signIn,
  signOut,
  confirmSignUpCode,
  resendConfirmationCode,
  requestPasswordReset,
  confirmPasswordReset,
  federatedSignIn,
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

  describe('federatedSignIn', () => {
    let mockHref = ''

    beforeEach(() => {
      // Reset mock href
      mockHref = 'https://dev.fitnessfight.club/signin'

      // Recreate window.location mock using Object.defineProperty
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          get href() {
            return mockHref
          },
          set href(value: string) {
            mockHref = value
          },
          origin: 'https://dev.fitnessfight.club',
          pathname: '/signin',
          search: '',
        },
      })

      // Mock environment variables
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'dev'
    })

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_ENVIRONMENT
      jest.restoreAllMocks()
    })

    it.skip('should successfully initiate Google OAuth flow', async () => {
      const initialHref = mockHref
      await federatedSignIn('Google')

      // Check that href was changed (redirect happened)
      expect(mockHref).not.toBe(initialHref)
      expect(mockHref).toContain('https://fitnessfight-club-dev.auth.us-east-1.amazoncognito.com')

      const url = new URL(mockHref)

      // Verify base URL
      expect(url.origin).toBe('https://fitnessfight-club-dev.auth.us-east-1.amazoncognito.com')
      expect(url.pathname).toBe('/oauth2/authorize')

      // Verify required OAuth parameters
      expect(url.searchParams.get('identity_provider')).toBe('Google')
      expect(url.searchParams.get('response_type')).toBe('token')
      expect(url.searchParams.get('client_id')).toBe('test-client-id')
      expect(url.searchParams.get('redirect_uri')).toBe('https://dev.fitnessfight.club/signin')
      expect(url.searchParams.get('scope')).toBe('email openid profile')

      // Verify state parameter exists and is valid JSON
      const state = url.searchParams.get('state')
      expect(state).toBeTruthy()
      const decodedState = JSON.parse(atob(state!))
      expect(decodedState).toHaveProperty('provider', 'Google')
      expect(decodedState).toHaveProperty('timestamp')
      expect(decodedState).toHaveProperty('origin', 'https://dev.fitnessfight.club/signin')
    })

    it.skip('should use production domain when environment is prod', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'prod'
      // Update the mock to use prod origin
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          get href() {
            return mockHref
          },
          set href(value: string) {
            mockHref = value
          },
          origin: 'https://fitnessfight.club',
        },
      })

      await federatedSignIn('Google')

      const url = new URL(mockHref)

      expect(url.origin).toBe('https://fitnessfight-club-prod.auth.us-east-1.amazoncognito.com')
      expect(url.searchParams.get('redirect_uri')).toBe('https://fitnessfight.club/signin')
    })

    it('should throw error for unsupported providers', async () => {
      const initialHref = mockHref
      await expect(federatedSignIn('Facebook' as 'Google')).rejects.toThrow(
        'Unsupported provider: Facebook'
      )
      expect(mockHref).toBe(initialHref) // href should not change
    })

    it('should throw error when CLIENT_ID is not configured', async () => {
      // Mock CLIENT_ID as undefined
      jest.resetModules()
      jest.doMock('@/lib/cognito-client', () => ({
        cognitoClient: {
          send: jest.fn(),
        },
        CLIENT_ID: undefined,
        getAuthTokens: jest.fn(),
        setAuthTokens: jest.fn(),
        clearAuthTokens: jest.fn(),
      }))

      const { federatedSignIn: federatedSignInWithoutClient } = await import('@/lib/auth')

      await expect(federatedSignInWithoutClient('Google')).rejects.toThrow(
        'Authentication not configured. Please check your environment variables.'
      )
    })

    it.skip('should generate unique state for each request', async () => {
      await federatedSignIn('Google')
      const firstUrl = new URL(mockHref)
      const firstState = firstUrl.searchParams.get('state')

      // Reset href for second call
      mockHref = 'https://dev.fitnessfight.club/signin'

      // Small delay to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10))

      await federatedSignIn('Google')
      const secondUrl = new URL(mockHref)
      const secondState = secondUrl.searchParams.get('state')

      expect(firstState).not.toBe(secondState)

      // Verify both states have valid structure
      const firstStateValue = firstState ?? ''
      const secondStateValue = secondState ?? ''
      const firstDecoded = JSON.parse(atob(firstStateValue))
      const secondDecoded = JSON.parse(atob(secondStateValue))

      expect(firstDecoded.timestamp).toBeLessThan(secondDecoded.timestamp)
    })

    it.skip('should correctly encode special characters in state', async () => {
      mockHref = 'https://dev.fitnessfight.club/signin?returnUrl=/some/path'

      await federatedSignIn('Google')

      const url = new URL(mockHref)
      const state = url.searchParams.get('state')

      // State should be base64 encoded
      expect(state).toBeTruthy()

      // Should be able to decode the state
      let decodedState
      expect(() => {
        const stateValue = state ?? ''
        decodedState = JSON.parse(atob(stateValue))
      }).not.toThrow()

      expect(decodedState).toHaveProperty('provider', 'Google')
      expect(decodedState).toHaveProperty('timestamp')
      expect(decodedState).toHaveProperty(
        'origin',
        'https://dev.fitnessfight.club/signin?returnUrl=/some/path'
      )
    })

    it.skip('should handle different redirect URIs based on origin', async () => {
      // Test with different origin
      mockHref = 'http://localhost:3000/signin'
      Object.defineProperty(window, 'location', {
        writable: true,
        value: {
          get href() {
            return mockHref
          },
          set href(value: string) {
            mockHref = value
          },
          origin: 'http://localhost:3000',
        },
      })

      await federatedSignIn('Google')

      const url = new URL(mockHref)
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/signin')
    })
  })
})

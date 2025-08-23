/**
 * @jest-environment node
 */

jest.mock('aws-amplify/auth')
jest.mock('next/headers')

// Mock the adapter-nextjs module
jest.mock('@aws-amplify/adapter-nextjs', () => {
  const mockRunWithAmplifyServerContext = jest.fn()
  return {
    createServerRunner: jest.fn(() => ({
      runWithAmplifyServerContext: mockRunWithAmplifyServerContext,
    })),
    __getMockRunWithAmplifyServerContext: () => mockRunWithAmplifyServerContext,
  }
})

import { getCurrentUserServer, getAuthTokenServer } from '@/lib/auth-server'
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth'
import { cookies } from 'next/headers'

// Get the mock function after module is loaded
const getMockRunWithAmplifyServerContext = () => {
  const module = jest.requireMock('@aws-amplify/adapter-nextjs')
  return module.__getMockRunWithAmplifyServerContext()
}

describe('Auth Server Functions', () => {
  let mockRunWithAmplifyServerContext: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Get the mock function
    mockRunWithAmplifyServerContext = getMockRunWithAmplifyServerContext()

    // Mock cookies
    ;(cookies as jest.Mock).mockReturnValue({})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getCurrentUserServer', () => {
    it('should return current user with all attributes', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
      }

      const mockSession = {
        tokens: {
          idToken: {
            payload: {
              email: 'test@example.com',
            },
          },
        },
      }

      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        // Mock the auth functions that will be called inside operation
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(fetchAuthSession as jest.Mock).mockResolvedValue(mockSession)
        // Call the operation function and return its result
        return await operation()
      })

      const result = await getCurrentUserServer()

      expect(mockRunWithAmplifyServerContext).toHaveBeenCalledWith({
        nextServerContext: { cookies: expect.any(Function) },
        operation: expect.any(Function),
      })

      expect(result).toEqual({
        userId: 'test@example.com',
        username: 'test@example.com',
        cognitoId: 'cognito-123',
        email: 'test@example.com',
      })
    })

    it('should return null when user is not authenticated', async () => {
      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        ;(getCurrentUser as jest.Mock).mockRejectedValue(new Error('Not authenticated'))
        return await operation()
      })

      const result = await getCurrentUserServer()

      expect(result).toBeNull()
    })

    it('should handle missing email in session', async () => {
      const mockUser = {
        username: 'test@example.com',
        userId: 'cognito-123',
      }

      const mockSession = {
        tokens: {
          idToken: {
            payload: {},
          },
        },
      }

      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        ;(getCurrentUser as jest.Mock).mockResolvedValue(mockUser)
        ;(fetchAuthSession as jest.Mock).mockResolvedValue(mockSession)
        return await operation()
      })

      const result = await getCurrentUserServer()

      expect(result).toEqual({
        userId: 'test@example.com',
        username: 'test@example.com',
        cognitoId: 'cognito-123',
        email: undefined,
      })
    })

    it('should handle errors gracefully', async () => {
      mockRunWithAmplifyServerContext.mockRejectedValue(new Error('Server error'))

      const result = await getCurrentUserServer()

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Get current user error:', expect.any(Error))
    })
  })

  describe('getAuthTokenServer', () => {
    it('should return ID token from session', async () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token'
      const mockSession = {
        tokens: {
          idToken: {
            toString: () => mockToken,
          },
        },
      }

      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        ;(fetchAuthSession as jest.Mock).mockResolvedValue(mockSession)
        return await operation()
      })

      const result = await getAuthTokenServer()

      expect(mockRunWithAmplifyServerContext).toHaveBeenCalledWith({
        nextServerContext: { cookies: expect.any(Function) },
        operation: expect.any(Function),
      })

      expect(result).toBe(mockToken)
    })

    it('should return null when no token is available', async () => {
      const mockSession = {
        tokens: {},
      }

      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        ;(fetchAuthSession as jest.Mock).mockResolvedValue(mockSession)
        return await operation()
      })

      const result = await getAuthTokenServer()

      expect(result).toBeNull()
    })

    it('should return null when session fetch fails', async () => {
      mockRunWithAmplifyServerContext.mockImplementation(async ({ operation }) => {
        ;(fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Session error'))
        return await operation()
      })

      const result = await getAuthTokenServer()

      expect(result).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      mockRunWithAmplifyServerContext.mockRejectedValue(new Error('Server error'))

      const result = await getAuthTokenServer()

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Get auth token error:', expect.any(Error))
    })
  })
})

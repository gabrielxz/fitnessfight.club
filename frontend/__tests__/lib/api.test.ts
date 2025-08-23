import { fetchWeeklyStats, checkStravaConnection } from '@/lib/api'
import { getConfig } from '@/lib/config'
import { getAuthTokens } from '@/lib/cognito-client'

// Mock dependencies
jest.mock('@/lib/config')
jest.mock('@/lib/cognito-client')

// Mock fetch
global.fetch = jest.fn()

describe('API Client Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Default mock config
    ;(getConfig as jest.Mock).mockReturnValue({
      apiUrl: 'https://api.test.com/api/v1',
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('fetchWeeklyStats', () => {
    it('should fetch weekly stats successfully', async () => {
      const mockToken = 'test-id-token'
      const mockStats = {
        success: true,
        userId: '12345',
        weekRange: 'Jan 22 - Jan 28',
        totalHours: 5.5,
        activityCount: 3,
        activities: [],
      }

      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: mockToken,
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toEqual(mockStats)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/users/12345/weekly-stats',
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        }
      )
    })

    it('should return null when no auth token is available', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: null,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalledWith('No auth token available')
    })

    it('should handle 401 unauthorized response', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Authentication expired')
    })

    it('should handle 403 forbidden response', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Not authorized to view these stats')
    })

    it('should handle other error responses', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Failed to fetch weekly stats: 500')
    })

    it('should handle network errors', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })

      const networkError = new Error('Network error')
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(networkError)

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Error fetching weekly stats:', networkError)
    })

    it('should handle different user IDs', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await fetchWeeklyStats('user-123-456')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/users/user-123-456/weekly-stats',
        expect.any(Object)
      )
    })
  })

  describe('checkStravaConnection', () => {
    it('should return connected status when user has Strava connected', async () => {
      const mockToken = 'test-id-token'
      const mockUserResponse = {
        success: true,
        user: {
          userId: '12345',
          stravaId: '12345',
          firstName: 'John',
          lastName: 'Doe',
        },
        cognitoId: 'cognito-123',
      }

      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: mockToken,
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: true,
        athleteId: '12345',
      })
      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/api/v1/users', {
        headers: {
          Authorization: `Bearer ${mockToken}`,
        },
      })
    })

    it('should return not connected when user has no Strava ID', async () => {
      const mockUserResponse = {
        success: true,
        user: {
          userId: '12345',
          // No stravaId
          firstName: 'John',
          lastName: 'Doe',
        },
        cognitoId: 'cognito-123',
      }

      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: false,
      })
    })

    it('should return not connected when user is null', async () => {
      const mockUserResponse = {
        success: true,
        user: null,
        cognitoId: 'cognito-123',
      }

      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: false,
      })
    })

    it('should return null when no auth token is available', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: null,
      })

      const result = await checkStravaConnection()

      expect(result).toBeNull()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should return not connected when API call fails', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: false,
      })
    })

    it('should handle network errors', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })

      const networkError = new Error('Network error')
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(networkError)

      const result = await checkStravaConnection()

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Error checking Strava connection:', networkError)
    })

    it('should handle missing response fields gracefully', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}), // Empty response
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: false,
      })
    })

    it('should handle different API URLs from config', async () => {
      ;(getConfig as jest.Mock).mockReturnValue({
        apiUrl: 'https://different-api.com/api/v2',
      })
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { stravaId: '123', userId: '123' } }),
      })

      await checkStravaConnection()

      expect(global.fetch).toHaveBeenCalledWith(
        'https://different-api.com/api/v2/users',
        expect.any(Object)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined token gracefully in fetchWeeklyStats', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({})

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('No auth token available')
    })

    it('should handle undefined token gracefully in checkStravaConnection', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({})

      const result = await checkStravaConnection()

      expect(result).toBeNull()
    })

    it('should handle malformed JSON response in fetchWeeklyStats', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Error fetching weekly stats:', expect.any(Error))
    })

    it('should handle malformed JSON response in checkStravaConnection', async () => {
      ;(getAuthTokens as jest.Mock).mockReturnValue({
        IdToken: 'test-token',
      })
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      const result = await checkStravaConnection()

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Error checking Strava connection:',
        expect.any(Error)
      )
    })
  })
})

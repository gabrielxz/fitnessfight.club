import { fetchWeeklyStats, checkStravaConnection } from '@/lib/api'
import { getConfig } from '@/lib/config'

// Mock dependencies
jest.mock('@/lib/config')

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
      const mockStats = {
        success: true,
        userId: '12345',
        weekRange: 'Jan 22 - Jan 28',
        totalHours: 5.5,
        activityCount: 3,
        activities: [],
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toEqual(mockStats)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/users/12345/weekly-stats'
      )
    })

    it('should handle 401 unauthorized response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Authentication expired')
    })

    it('should handle 403 forbidden response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Not authorized to view these stats')
    })

    it('should handle other error responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Failed to fetch weekly stats: 500')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(networkError)

      const result = await fetchWeeklyStats('12345')

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Error fetching weekly stats:', networkError)
    })

    it('should handle different user IDs', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      await fetchWeeklyStats('user-123-456')

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.test.com/api/v1/users/user-123-456/weekly-stats'
      )
    })
  })

  describe('checkStravaConnection', () => {
    it('should return connected status when user has Strava connected', async () => {
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

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: true,
        athleteId: '12345',
      })
      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/api/v1/users')
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

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUserResponse,
      })

      const result = await checkStravaConnection()

      expect(result).toEqual({
        connected: false,
      })
    })

    it('should return not connected when API call fails', async () => {
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
      const networkError = new Error('Network error')
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(networkError)

      const result = await checkStravaConnection()

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith('Error checking Strava connection:', networkError)
    })

    it('should handle missing response fields gracefully', async () => {
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
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { stravaId: '123', userId: '123' } }),
      })

      await checkStravaConnection()

      expect(global.fetch).toHaveBeenCalledWith('https://different-api.com/api/v2/users')
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed JSON response in fetchWeeklyStats', async () => {
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

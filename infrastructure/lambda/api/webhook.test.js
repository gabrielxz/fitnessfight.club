const { handler } = require('./index')
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb')
jest.mock('@aws-sdk/client-secrets-manager')
jest.mock('./auth', () => ({
  authenticate: jest.fn(),
  requireAuth: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('Webhook Processing', () => {
  let mockDocClient

  beforeEach(() => {
    jest.clearAllMocks()
    console.log = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()

    // Mock Date to avoid timezone issues
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-25T12:00:00Z'))

    // Setup mock DynamoDB client
    mockDocClient = {
      send: jest.fn(),
    }
    DynamoDBDocumentClient.from = jest.fn().mockReturnValue(mockDocClient)

    // Setup mock Secrets Manager client
    SecretsManagerClient.prototype.send = jest.fn()

    // Set environment variables
    process.env.USERS_TABLE = 'test-users-table'
    process.env.ACTIVITIES_TABLE = 'test-activities-table'
    process.env.STRAVA_CLIENT_ID_SECRET_NAME = 'test-client-id-secret'
    process.env.STRAVA_CLIENT_SECRET_SECRET_NAME = 'test-client-secret-secret'
    process.env.STRAVA_WEBHOOK_VERIFY_TOKEN = 'test-verify-token'
    process.env.ENVIRONMENT = 'dev'
    process.env.FRONTEND_URL = 'https://dev.fitnessfight.club'
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('Webhook Verification (GET)', () => {
    it('should verify webhook subscription with correct token', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/webhook/strava',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': 'challenge-123',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body['hub.challenge']).toBe('challenge-123')
    })

    it('should reject webhook verification with incorrect token', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/webhook/strava',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'challenge-123',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Invalid verification token')
    })

    it('should reject webhook verification with missing challenge', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/webhook/strava',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
    })
  })

  describe('Activity Create Event', () => {
    it('should process activity create event successfully', async () => {
      const mockUser = {
        userId: '12345',
        accessToken: 'valid-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }

      const mockActivity = {
        id: 987654321,
        name: 'Morning Run',
        type: 'Run',
        distance: 5243.2,
        moving_time: 1825,
        elapsed_time: 2100,
        start_date: '2024-01-22T13:30:00Z',
        average_speed: 2.87,
        max_speed: 4.2,
        average_heartrate: 145,
        max_heartrate: 165,
        total_elevation_gain: 125.5,
      }

      // Mock DynamoDB get user
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: mockUser })
        }
        if (command instanceof PutCommand) {
          return Promise.resolve({})
        }
        return Promise.resolve({})
      })

      // Mock Strava API call
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivity,
      })

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'create',
          owner_id: 12345,
          subscription_id: 'sub-123',
          event_time: 1705930200,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Webhook event processed')

      // Verify fetch was called for activity details
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.strava.com/api/v3/activities/987654321',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer valid-token',
          },
        })
      )

      // Verify activity was saved to DynamoDB
      expect(mockDocClient.send).toHaveBeenCalled()
      const calls = mockDocClient.send.mock.calls
      const putCall = calls.find(call => 
        call[0].input && 
        call[0].input.TableName === 'test-activities-table' &&
        call[0].input.Item
      )
      expect(putCall).toBeDefined()
      expect(putCall[0].input.Item).toMatchObject({
        userId: '12345',
        activityId: '987654321',
        name: 'Morning Run',
        type: 'Run',
        distance: 5243.2,
        duration: 1825,
      })
    })

    it('should handle expired token and refresh', async () => {
      const mockUser = {
        userId: '12345',
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired
      }

      const mockActivity = {
        id: 987654321,
        name: 'Morning Run',
        type: 'Run',
        distance: 5243.2,
        moving_time: 1825,
      }

      // Mock DynamoDB get user
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: mockUser })
        }
        return Promise.resolve({})
      })

      // Mock secrets
      SecretsManagerClient.prototype.send.mockImplementation((command) => {
        if (command.input.SecretId.includes('client-id')) {
          return Promise.resolve({ SecretString: 'test-client-id' })
        }
        if (command.input.SecretId.includes('client-secret')) {
          return Promise.resolve({ SecretString: 'test-client-secret' })
        }
      })

      // Mock Strava API calls
      // First call fails with 401
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })
      // Token refresh call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      })
      // Second activity fetch succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivity,
      })

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'create',
          owner_id: 12345,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('should handle missing user gracefully', async () => {
      // Mock DynamoDB get user returns no item
      mockDocClient.send.mockResolvedValue({ Item: null })

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'create',
          owner_id: 99999, // Non-existent user
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200) // Still return 200 to Strava
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting valid token'),
        expect.any(Error)
      )
    })
  })

  describe('Activity Update Event', () => {
    it('should process activity update event successfully', async () => {
      const mockUser = {
        userId: '12345',
        accessToken: 'valid-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }

      const mockActivity = {
        id: 987654321,
        name: 'Updated Morning Run',
        type: 'Run',
        distance: 6000,
        moving_time: 2000,
      }

      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof GetCommand) {
          return Promise.resolve({ Item: mockUser })
        }
        if (command instanceof PutCommand) {
          return Promise.resolve({})
        }
        return Promise.resolve({})
      })

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivity,
      })

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'update',
          owner_id: 12345,
          updates: {
            title: 'Updated Morning Run',
          },
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)

      // Verify activity was updated in DynamoDB
      expect(mockDocClient.send).toHaveBeenCalled()
      const calls = mockDocClient.send.mock.calls
      const putCall = calls.find(call => 
        call[0].input && 
        call[0].input.TableName === 'test-activities-table' &&
        call[0].input.Item
      )
      expect(putCall).toBeDefined()
      expect(putCall[0].input.Item.name).toBe('Updated Morning Run')
    })
  })

  describe('Activity Delete Event', () => {
    it('should process activity delete event successfully', async () => {
      mockDocClient.send.mockResolvedValue({})

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'delete',
          owner_id: 12345,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)

      // Verify activity was deleted from DynamoDB
      expect(mockDocClient.send).toHaveBeenCalled()
      const calls = mockDocClient.send.mock.calls
      const deleteCall = calls.find(call => 
        call[0].input && 
        call[0].input.TableName === 'test-activities-table' &&
        call[0].input.Key
      )
      expect(deleteCall).toBeDefined()
      expect(deleteCall[0].input.Key).toMatchObject({
        userId: '12345',
        activityId: '987654321',
      })
    })

    it('should handle delete error gracefully', async () => {
      mockDocClient.send.mockRejectedValue(new Error('DynamoDB error'))

      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'delete',
          owner_id: 12345,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200) // Still return 200 to Strava
      expect(console.error).toHaveBeenCalledWith(
        'Failed to delete activity:',
        expect.any(Error)
      )
    })
  })

  describe('Non-Activity Events', () => {
    it('should ignore non-activity webhook events', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'athlete',
          object_id: 12345,
          aspect_type: 'update',
          owner_id: 12345,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.message).toBe('Non-activity event ignored')

      // Verify no DynamoDB operations were performed
      expect(mockDocClient.send).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed webhook body', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: 'invalid-json',
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Failed to process webhook event')
    })

    it('should handle missing webhook body', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: null,
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('No event data provided')
    })

    it('should handle unknown aspect type', async () => {
      const event = {
        httpMethod: 'POST',
        path: '/api/v1/webhook/strava',
        body: JSON.stringify({
          object_type: 'activity',
          object_id: 987654321,
          aspect_type: 'unknown-type',
          owner_id: 12345,
        }),
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      expect(console.log).toHaveBeenCalledWith('Unknown aspect type: unknown-type')
    })
  })
})
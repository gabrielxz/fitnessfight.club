const { handler } = require('./index')
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb')
const { authenticate } = require('./auth')
const { startOfWeek, endOfWeek } = require('date-fns')

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb')
jest.mock('./auth')

describe('Weekly Stats Endpoint', () => {
  let mockDocClient
  const mockDate = new Date('2024-01-25T12:00:00Z') // Thursday

  beforeEach(() => {
    jest.clearAllMocks()
    console.log = jest.fn()
    console.error = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()

    // Mock current date
    jest.useFakeTimers()
    jest.setSystemTime(mockDate)

    // Setup mock DynamoDB client
    mockDocClient = {
      send: jest.fn(),
    }
    DynamoDBDocumentClient.from = jest.fn().mockReturnValue(mockDocClient)

    // Set environment variables
    process.env.USERS_TABLE = 'test-users-table'
    process.env.ACTIVITIES_TABLE = 'test-activities-table'
    process.env.ENVIRONMENT = 'dev'
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('Authentication', () => {
    it('should require authentication for weekly stats', async () => {
      authenticate.mockResolvedValue({
        authenticated: false,
        error: 'No authentication token provided',
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Unauthorized')
      expect(body.message).toBe('No authentication token provided')
    })

    it('should reject requests for other users data', async () => {
      authenticate.mockResolvedValue({
        authenticated: true,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
        },
      })

      // Mock user query - returns different user ID
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand && command.input.IndexName === 'cognitoId-index') {
          return Promise.resolve({
            Items: [{ userId: '99999', cognitoId: 'cognito-user-123' }],
          })
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats', // Requesting different user's data
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Forbidden')
      expect(body.message).toBe('You can only view your own stats')
    })
  })

  describe('Weekly Stats Calculation', () => {
    beforeEach(() => {
      authenticate.mockResolvedValue({
        authenticated: true,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
        },
      })
    })

    it('should return weekly stats with activities', async () => {
      const mockActivities = [
        {
          userId: '12345',
          activityId: '1',
          name: 'Morning Run',
          type: 'Run',
          duration: 3600, // 1 hour
          distance: 10000,
          startDate: '2024-01-22T08:00:00Z',
          timestamp: 1705910400,
        },
        {
          userId: '12345',
          activityId: '2',
          name: 'Evening Ride',
          type: 'Ride',
          duration: 5400, // 1.5 hours
          distance: 30000,
          startDate: '2024-01-23T18:00:00Z',
          timestamp: 1706032800,
        },
      ]

      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            return Promise.resolve({ Items: mockActivities })
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.userId).toBe('12345')
      expect(body.totalHours).toBe(2.5) // 1 + 1.5 hours
      expect(body.activityCount).toBe(2)
      expect(body.activities).toHaveLength(2)
      expect(body.weekRange).toBe('Jan 22 - Jan 28')
    })

    it('should handle empty week (no activities)', async () => {
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            return Promise.resolve({ Items: [] })
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
      expect(body.totalHours).toBe(0)
      expect(body.activityCount).toBe(0)
      expect(body.activities).toHaveLength(0)
    })

    it('should correctly calculate week boundaries (Monday to Sunday)', async () => {
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            // Verify correct timestamps are used
            const expectedWeekStart = Math.floor(
              startOfWeek(mockDate, { weekStartsOn: 1 }).getTime() / 1000
            )
            const expectedWeekEnd = Math.floor(
              endOfWeek(mockDate, { weekStartsOn: 1 }).getTime() / 1000
            )
            
            expect(command.input.ExpressionAttributeValues[':start']).toBe(expectedWeekStart)
            expect(command.input.ExpressionAttributeValues[':end']).toBe(expectedWeekEnd)
            
            return Promise.resolve({ Items: [] })
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      await handler(event)

      // Assertions are in the mock implementation above
      expect(mockDocClient.send).toHaveBeenCalled()
    })

    it('should round hours to 1 decimal place', async () => {
      const mockActivities = [
        {
          userId: '12345',
          activityId: '1',
          name: 'Run 1',
          type: 'Run',
          duration: 3661, // 1.0169... hours
          distance: 10000,
          startDate: '2024-01-22T08:00:00Z',
        },
        {
          userId: '12345',
          activityId: '2',
          name: 'Run 2',
          type: 'Run',
          duration: 7322, // 2.0338... hours
          distance: 15000,
          startDate: '2024-01-23T08:00:00Z',
        },
      ]

      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            return Promise.resolve({ Items: mockActivities })
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)
      const body = JSON.parse(response.body)
      expect(body.totalHours).toBe(3.1) // Should be rounded to 1 decimal place
    })

    it('should include activity details in response', async () => {
      const mockActivity = {
        userId: '12345',
        activityId: '123456',
        name: 'Test Activity',
        type: 'Run',
        duration: 3600,
        distance: 10000,
        startDate: '2024-01-22T08:00:00Z',
        timestamp: 1705910400,
      }

      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            return Promise.resolve({ Items: [mockActivity] })
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)
      const body = JSON.parse(response.body)
      
      expect(body.activities).toHaveLength(1)
      expect(body.activities[0]).toEqual({
        activityId: '123456',
        name: 'Test Activity',
        type: 'Run',
        duration: 3600,
        distance: 10000,
        startDate: '2024-01-22T08:00:00Z',
      })
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      authenticate.mockResolvedValue({
        authenticated: true,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
        },
      })
    })

    it('should handle missing user ID in path', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users//weekly-stats', // Missing user ID
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Bad Request')
      expect(body.message).toBe('User ID is required')
    })

    it('should handle DynamoDB query errors', async () => {
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            throw new Error('DynamoDB error')
          }
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Internal Server Error')
      expect(body.message).toBe('Failed to fetch weekly stats')
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching weekly stats:',
        expect.any(Error)
      )
    })

    it('should handle user not found in database', async () => {
      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand && command.input.IndexName === 'cognitoId-index') {
          return Promise.resolve({ Items: [] }) // No user found
        }
        return Promise.resolve({})
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Forbidden')
      expect(body.message).toBe('You can only view your own stats')
    })
  })

  describe('Date Boundary Edge Cases', () => {
    beforeEach(() => {
      authenticate.mockResolvedValue({
        authenticated: true,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
        },
      })

      mockDocClient.send.mockImplementation((command) => {
        if (command instanceof QueryCommand) {
          if (command.input.IndexName === 'cognitoId-index') {
            return Promise.resolve({
              Items: [{ userId: '12345', cognitoId: 'cognito-user-123' }],
            })
          }
          if (command.input.IndexName === 'userId-timestamp-index') {
            return Promise.resolve({ Items: [] })
          }
        }
        return Promise.resolve({})
      })
    })

    it('should handle Sunday date correctly', async () => {
      // Set date to Sunday
      const sunday = new Date('2024-01-28T12:00:00Z')
      jest.setSystemTime(sunday)

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)
      const body = JSON.parse(response.body)
      
      // Should still be in the same week (Jan 22 - Jan 28)
      expect(body.weekRange).toBe('Jan 22 - Jan 28')
    })

    it('should handle Monday date correctly', async () => {
      // Set date to Monday
      const monday = new Date('2024-01-29T12:00:00Z')
      jest.setSystemTime(monday)

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/12345/weekly-stats',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      }

      const response = await handler(event)
      const body = JSON.parse(response.body)
      
      // Should be in the new week (Jan 29 - Feb 4)
      expect(body.weekRange).toBe('Jan 29 - Feb 4')
    })
  })
})
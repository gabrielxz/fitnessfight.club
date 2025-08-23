const { handler } = require('./index')
const { authenticate } = require('./auth')
const AWS = require('aws-sdk')

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockDynamoDB = {
    get: jest.fn(),
    put: jest.fn(),
    query: jest.fn(),
    scan: jest.fn(),
  }
  
  const mockSecretsManager = {
    getSecretValue: jest.fn(),
  }
  
  return {
    DynamoDB: {
      DocumentClient: jest.fn(() => mockDynamoDB),
    },
    SecretsManager: jest.fn(() => mockSecretsManager),
  }
})

// Mock auth module
jest.mock('./auth')

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn())
const fetch = require('node-fetch')

describe('Lambda Handler Integration Tests', () => {
  let mockDynamoDB
  let mockSecretsManager

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()
    
    // Get mock instances
    mockDynamoDB = new AWS.DynamoDB.DocumentClient()
    mockSecretsManager = new AWS.SecretsManager()
    
    // Setup default environment
    process.env.USERS_TABLE = 'test-users-table'
    process.env.ACTIVITIES_TABLE = 'test-activities-table'
    process.env.CHALLENGES_TABLE = 'test-challenges-table'
    process.env.STRAVA_CLIENT_ID = 'test-client-id'
    process.env.STRAVA_CLIENT_SECRET = 'test-client-secret'
    process.env.USER_POOL_ID = 'test-user-pool-id'
    process.env.USER_POOL_CLIENT_ID = 'test-client-id'
  })

  afterEach(() => {
    // Clean up environment
    delete process.env.USERS_TABLE
    delete process.env.ACTIVITIES_TABLE
    delete process.env.CHALLENGES_TABLE
    delete process.env.STRAVA_CLIENT_ID
    delete process.env.STRAVA_CLIENT_SECRET
    delete process.env.USER_POOL_ID
    delete process.env.USER_POOL_CLIENT_ID
  })

  describe('Strava OAuth with Cognito Authentication', () => {
    describe('GET /api/v1/auth/strava - Initiate OAuth', () => {
      it('should require authentication to initiate Strava OAuth', async () => {
        authenticate.mockResolvedValue({
          authenticated: false,
          error: 'No authentication token provided',
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava',
          headers: {},
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(401)
        const body = JSON.parse(response.body)
        expect(body.error).toBe('Unauthorized')
        expect(body.message).toBe('No authentication token provided')
      })

      it('should check for existing Strava connection before initiating OAuth', async () => {
        authenticate.mockResolvedValue({
          authenticated: true,
          user: {
            cognitoId: 'cognito-123',
            email: 'test@example.com',
          },
        })

        // Mock user already has Strava connected
        mockDynamoDB.query.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Items: [{
              userId: 'strava-456',
              cognitoId: 'cognito-123',
              stravaId: '456',
              accessToken: 'existing-token',
            }],
          }),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava',
          headers: {
            Authorization: 'Bearer valid.token',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.message).toBe('Strava account already connected')
        expect(body.user).toEqual({
          stravaId: '456',
          connected: true,
        })

        // Should query by cognitoId GSI
        expect(mockDynamoDB.query).toHaveBeenCalledWith({
          TableName: 'test-users-table',
          IndexName: 'cognitoId-index',
          KeyConditionExpression: 'cognitoId = :cognitoId',
          ExpressionAttributeValues: {
            ':cognitoId': 'cognito-123',
          },
        })
      })

      it('should return authorization URL with cognitoId in state for new connections', async () => {
        authenticate.mockResolvedValue({
          authenticated: true,
          user: {
            cognitoId: 'cognito-123',
            email: 'test@example.com',
          },
        })

        // No existing Strava connection
        mockDynamoDB.query.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Items: [],
          }),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava',
          headers: {
            Authorization: 'Bearer valid.token',
            host: 'api.dev.fitnessfight.club',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.url).toContain('https://www.strava.com/oauth/authorize')
        expect(body.url).toContain('client_id=test-client-id')
        expect(body.url).toContain('redirect_uri=')
        expect(body.url).toContain('response_type=code')
        expect(body.url).toContain('scope=activity:read_all')
        
        // State should include cognitoId
        const urlParams = new URL(body.url).searchParams
        const state = JSON.parse(urlParams.get('state'))
        expect(state.cognitoId).toBe('cognito-123')
      })
    })

    describe('GET /api/v1/auth/strava/callback - Handle OAuth Callback', () => {
      it('should link Strava account with cognitoId from state', async () => {
        const state = JSON.stringify({ cognitoId: 'cognito-123' })
        
        // Mock Strava token exchange
        fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            token_type: 'Bearer',
            expires_at: 1755846374,
            expires_in: 21600,
            refresh_token: 'refresh-token-123',
            access_token: 'access-token-123',
            athlete: {
              id: 789,
              username: 'testuser',
              firstname: 'Test',
              lastname: 'User',
            },
          }),
        })

        // Mock DynamoDB put
        mockDynamoDB.put.mockReturnValue({
          promise: jest.fn().mockResolvedValue({}),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava/callback',
          queryStringParameters: {
            code: 'auth-code-123',
            state: state,
          },
          headers: {
            host: 'api.dev.fitnessfight.club',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(302)
        expect(response.headers.Location).toBe('https://dev.fitnessfight.club/?strava=connected')

        // Should save user with cognitoId
        expect(mockDynamoDB.put).toHaveBeenCalledWith({
          TableName: 'test-users-table',
          Item: expect.objectContaining({
            userId: '789',
            cognitoId: 'cognito-123',
            stravaId: '789',
            athleteId: 789,
            username: 'testuser',
            firstName: 'Test',
            lastName: 'User',
            authProvider: 'cognito',
            emailVerified: true,
          }),
        })
      })

      it('should handle callback without cognitoId for backward compatibility', async () => {
        // Mock Strava token exchange
        fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({
            token_type: 'Bearer',
            expires_at: 1755846374,
            expires_in: 21600,
            refresh_token: 'refresh-token-123',
            access_token: 'access-token-123',
            athlete: {
              id: 789,
              username: 'testuser',
              firstname: 'Test',
              lastname: 'User',
            },
          }),
        })

        mockDynamoDB.put.mockReturnValue({
          promise: jest.fn().mockResolvedValue({}),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava/callback',
          queryStringParameters: {
            code: 'auth-code-123',
          },
          headers: {
            host: 'api.dev.fitnessfight.club',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(302)
        
        // Should save user without cognitoId (Strava-only auth)
        expect(mockDynamoDB.put).toHaveBeenCalledWith({
          TableName: 'test-users-table',
          Item: expect.objectContaining({
            userId: '789',
            stravaId: '789',
            authProvider: 'strava',
            emailVerified: false,
          }),
        })
        
        // cognitoId should not be set
        const putCall = mockDynamoDB.put.mock.calls[0][0]
        expect(putCall.Item.cognitoId).toBeUndefined()
      })

      it('should handle Strava API errors gracefully', async () => {
        const state = JSON.stringify({ cognitoId: 'cognito-123' })
        
        // Mock Strava API error
        fetch.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: jest.fn().mockResolvedValue('Invalid authorization code'),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/auth/strava/callback',
          queryStringParameters: {
            code: 'invalid-code',
            state: state,
          },
          headers: {
            host: 'api.dev.fitnessfight.club',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(302)
        expect(response.headers.Location).toBe('https://dev.fitnessfight.club/?error=auth_failed')
        expect(console.error).toHaveBeenCalledWith(
          'Strava API error:',
          expect.any(String)
        )
      })
    })

    describe('GET /api/v1/users/profile - Get User Profile with Auth', () => {
      it('should require authentication to get user profile', async () => {
        authenticate.mockResolvedValue({
          authenticated: false,
          error: 'Invalid token',
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/users/profile',
          headers: {
            Authorization: 'Bearer invalid.token',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(401)
        const body = JSON.parse(response.body)
        expect(body.error).toBe('Unauthorized')
      })

      it('should get user profile by cognitoId', async () => {
        authenticate.mockResolvedValue({
          authenticated: true,
          user: {
            cognitoId: 'cognito-123',
            email: 'test@example.com',
          },
        })

        mockDynamoDB.query.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Items: [{
              userId: 'strava-456',
              cognitoId: 'cognito-123',
              stravaId: '456',
              firstName: 'Test',
              lastName: 'User',
              email: 'test@example.com',
            }],
          }),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/users/profile',
          headers: {
            Authorization: 'Bearer valid.token',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(200)
        const body = JSON.parse(response.body)
        expect(body.user).toEqual({
          userId: 'strava-456',
          cognitoId: 'cognito-123',
          stravaId: '456',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        })

        expect(mockDynamoDB.query).toHaveBeenCalledWith({
          TableName: 'test-users-table',
          IndexName: 'cognitoId-index',
          KeyConditionExpression: 'cognitoId = :cognitoId',
          ExpressionAttributeValues: {
            ':cognitoId': 'cognito-123',
          },
        })
      })

      it('should return 404 if user not found', async () => {
        authenticate.mockResolvedValue({
          authenticated: true,
          user: {
            cognitoId: 'cognito-123',
            email: 'test@example.com',
          },
        })

        mockDynamoDB.query.mockReturnValue({
          promise: jest.fn().mockResolvedValue({
            Items: [],
          }),
        })

        const event = {
          httpMethod: 'GET',
          path: '/api/v1/users/profile',
          headers: {
            Authorization: 'Bearer valid.token',
          },
        }

        const response = await handler(event)

        expect(response.statusCode).toBe(404)
        const body = JSON.parse(response.body)
        expect(body.error).toBe('User not found')
      })
    })
  })

  describe('Protected Endpoints', () => {
    it('should protect activities endpoint', async () => {
      authenticate.mockResolvedValue({
        authenticated: false,
        error: 'No token',
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/activities',
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Unauthorized')
    })

    it('should protect challenges endpoint', async () => {
      authenticate.mockResolvedValue({
        authenticated: false,
        error: 'No token',
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/challenges',
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Unauthorized')
    })

    it('should allow access to protected endpoints with valid token', async () => {
      authenticate.mockResolvedValue({
        authenticated: true,
        user: {
          cognitoId: 'cognito-123',
          email: 'test@example.com',
        },
      })

      mockDynamoDB.scan.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [
            { id: '1', name: 'Challenge 1' },
            { id: '2', name: 'Challenge 2' },
          ],
        }),
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/challenges',
        headers: {
          Authorization: 'Bearer valid.token',
        },
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.challenges).toHaveLength(2)
    })
  })

  describe('Public Endpoints', () => {
    it('should allow access to health endpoint without authentication', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/health',
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('healthy')
      expect(authenticate).not.toHaveBeenCalled()
    })

    it('should handle webhook verification without authentication', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/api/v1/webhook/strava',
        queryStringParameters: {
          'hub.mode': 'subscribe',
          'hub.challenge': 'test-challenge',
          'hub.verify_token': process.env.WEBHOOK_VERIFY_TOKEN || 'test-verify-token',
        },
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body['hub.challenge']).toBe('test-challenge')
      expect(authenticate).not.toHaveBeenCalled()
    })
  })

  describe('CORS Headers', () => {
    it('should include CORS headers in all responses', async () => {
      authenticate.mockResolvedValue({
        authenticated: false,
        error: 'No token',
      })

      const event = {
        httpMethod: 'GET',
        path: '/api/v1/users/profile',
        headers: {},
      }

      const response = await handler(event)

      expect(response.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      })
    })

    it('should handle OPTIONS requests for CORS preflight', async () => {
      const event = {
        httpMethod: 'OPTIONS',
        path: '/api/v1/users/profile',
        headers: {},
      }

      const response = await handler(event)

      expect(response.statusCode).toBe(200)
      expect(response.headers).toMatchObject({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      })
    })
  })
})
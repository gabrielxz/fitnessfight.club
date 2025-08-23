const { verifyToken, extractToken, authenticate, requireAuth } = require('./auth')
const { CognitoJwtVerifier } = require('aws-jwt-verify')

// Mock aws-jwt-verify
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(),
  },
}))

describe('Lambda Auth Module', () => {
  let mockVerifier

  beforeEach(() => {
    jest.clearAllMocks()
    console.error = jest.fn()
    console.info = jest.fn()
    console.warn = jest.fn()
    
    // Setup mock verifier
    mockVerifier = {
      verify: jest.fn(),
    }
    CognitoJwtVerifier.create.mockReturnValue(mockVerifier)
    
    // Set environment variables
    process.env.USER_POOL_ID = 'test-user-pool-id'
    process.env.USER_POOL_CLIENT_ID = 'test-client-id'
  })

  afterEach(() => {
    delete process.env.USER_POOL_ID
    delete process.env.USER_POOL_CLIENT_ID
  })

  describe('extractToken', () => {
    it('should extract token from Bearer Authorization header', () => {
      const headers = {
        Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
      }
      
      const token = extractToken(headers)
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token')
    })

    it('should extract token from lowercase authorization header', () => {
      const headers = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
      }
      
      const token = extractToken(headers)
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token')
    })

    it('should return token as-is if not Bearer format', () => {
      const headers = {
        Authorization: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
      }
      
      const token = extractToken(headers)
      expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token')
    })

    it('should return null if no authorization header', () => {
      const headers = {}
      
      const token = extractToken(headers)
      expect(token).toBeNull()
    })

    it('should return null if headers is undefined', () => {
      const token = extractToken(undefined)
      expect(token).toBeNull()
    })

    it('should return null if headers is null', () => {
      const token = extractToken(null)
      expect(token).toBeNull()
    })
  })

  describe('verifyToken', () => {
    it('should verify valid token successfully', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      const result = await verifyToken('valid.jwt.token')
      
      expect(CognitoJwtVerifier.create).toHaveBeenCalledWith({
        userPoolId: 'test-user-pool-id',
        tokenUse: 'id',
        clientId: 'test-client-id',
      })
      expect(mockVerifier.verify).toHaveBeenCalledWith('valid.jwt.token')
      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
        cognitoId: 'cognito-user-123',
        email: 'test@example.com',
      })
    })

    it('should return invalid for expired token', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Token expired'))
      
      const result = await verifyToken('expired.jwt.token')
      
      expect(result).toEqual({
        valid: false,
        error: 'Token expired',
      })
      expect(console.error).toHaveBeenCalledWith(
        'Token verification failed:',
        expect.any(Error)
      )
    })

    it('should return invalid for malformed token', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'))
      
      const result = await verifyToken('malformed.token')
      
      expect(result).toEqual({
        valid: false,
        error: 'Invalid token',
      })
    })

    it('should return invalid when no token provided', async () => {
      const result = await verifyToken(null)
      
      expect(result).toEqual({
        valid: false,
        error: 'No token provided',
      })
      expect(mockVerifier.verify).not.toHaveBeenCalled()
    })

    it('should return invalid when empty token provided', async () => {
      const result = await verifyToken('')
      
      expect(result).toEqual({
        valid: false,
        error: 'No token provided',
      })
      expect(mockVerifier.verify).not.toHaveBeenCalled()
    })

    it('should reuse verifier instance', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      await verifyToken('token1')
      await verifyToken('token2')
      
      // Should only create verifier once
      expect(CognitoJwtVerifier.create).toHaveBeenCalledTimes(1)
      expect(mockVerifier.verify).toHaveBeenCalledTimes(2)
    })

    it('should handle verification errors gracefully', async () => {
      mockVerifier.verify.mockRejectedValue({})
      
      const result = await verifyToken('token')
      
      expect(result).toEqual({
        valid: false,
        error: 'Token verification failed',
      })
    })
  })

  describe('authenticate', () => {
    it('should authenticate request with valid token', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      const event = {
        headers: {
          Authorization: 'Bearer valid.jwt.token',
        },
      }
      
      const result = await authenticate(event)
      
      expect(result).toEqual({
        authenticated: true,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
          payload: mockPayload,
        },
      })
    })

    it('should reject request with no token', async () => {
      const event = {
        headers: {},
      }
      
      const result = await authenticate(event)
      
      expect(result).toEqual({
        authenticated: false,
        error: 'No authentication token provided',
      })
    })

    it('should reject request with invalid token', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Invalid token'))
      
      const event = {
        headers: {
          Authorization: 'Bearer invalid.jwt.token',
        },
      }
      
      const result = await authenticate(event)
      
      expect(result).toEqual({
        authenticated: false,
        error: 'Invalid token',
      })
    })

    it('should handle missing headers gracefully', async () => {
      const event = {}
      
      const result = await authenticate(event)
      
      expect(result).toEqual({
        authenticated: false,
        error: 'No authentication token provided',
      })
    })
  })

  describe('requireAuth', () => {
    it('should call handler for authenticated request', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      const mockHandler = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ data: 'success' }),
      })
      
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {
          Authorization: 'Bearer valid.jwt.token',
        },
      }
      
      const response = await wrappedHandler(event)
      
      expect(mockHandler).toHaveBeenCalledWith({
        ...event,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
          payload: mockPayload,
        },
      })
      expect(response).toEqual({
        statusCode: 200,
        body: JSON.stringify({ data: 'success' }),
      })
    })

    it('should return 401 for unauthenticated request', async () => {
      const mockHandler = jest.fn()
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {},
      }
      
      const response = await wrappedHandler(event)
      
      expect(mockHandler).not.toHaveBeenCalled()
      expect(response).toEqual({
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'No authentication token provided',
        }),
      })
    })

    it('should return 401 for invalid token', async () => {
      mockVerifier.verify.mockRejectedValue(new Error('Token expired'))
      
      const mockHandler = jest.fn()
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {
          Authorization: 'Bearer expired.token',
        },
      }
      
      const response = await wrappedHandler(event)
      
      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Unauthorized')
      expect(body.message).toBe('Token expired')
    })

    it('should include CORS headers in error response', async () => {
      const mockHandler = jest.fn()
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {},
      }
      
      const response = await wrappedHandler(event)
      
      expect(response.headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      })
    })

    it('should add user to event context for authenticated request', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      let capturedEvent
      const mockHandler = jest.fn().mockImplementation((event) => {
        capturedEvent = event
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
        }
      })
      
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {
          Authorization: 'Bearer valid.token',
        },
        path: '/api/test',
      }
      
      await wrappedHandler(event)
      
      expect(capturedEvent).toEqual({
        ...event,
        user: {
          cognitoId: 'cognito-user-123',
          email: 'test@example.com',
          payload: mockPayload,
        },
      })
    })

    it('should handle handler errors gracefully', async () => {
      const mockPayload = {
        sub: 'cognito-user-123',
        email: 'test@example.com',
      }
      mockVerifier.verify.mockResolvedValue(mockPayload)
      
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'))
      const wrappedHandler = requireAuth(mockHandler)
      
      const event = {
        headers: {
          Authorization: 'Bearer valid.token',
        },
      }
      
      await expect(wrappedHandler(event)).rejects.toThrow('Handler error')
      expect(mockHandler).toHaveBeenCalled()
    })
  })
})
const { CognitoJwtVerifier } = require('aws-jwt-verify')

// Create JWT verifier instance
let verifier = null

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.USER_POOL_ID,
      tokenUse: 'id', // Use 'id' token for user attributes
      clientId: process.env.USER_POOL_CLIENT_ID,
    })
  }
  return verifier
}

/**
 * Verify a JWT token from Cognito
 * @param {string} token - The JWT token to verify
 * @returns {Promise<{valid: boolean, payload?: object, cognitoId?: string, email?: string, error?: string}>}
 */
async function verifyToken(token) {
  if (!token) {
    return { valid: false, error: 'No token provided' }
  }

  try {
    const verifier = getVerifier()
    const payload = await verifier.verify(token)
    
    return {
      valid: true,
      payload,
      cognitoId: payload.sub,
      email: payload.email,
    }
  } catch (error) {
    console.error('Token verification failed:', error)
    return {
      valid: false,
      error: error.message || 'Token verification failed',
    }
  }
}

/**
 * Extract token from Authorization header
 * @param {object} headers - Request headers
 * @returns {string|null} - The extracted token or null
 */
function extractToken(headers) {
  const authHeader = headers?.Authorization || headers?.authorization
  
  if (!authHeader) {
    return null
  }

  // Check for Bearer token format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Return as-is if not Bearer format (assume it's just the token)
  return authHeader
}

/**
 * Middleware to verify JWT token from request
 * @param {object} event - Lambda event object
 * @returns {Promise<{authenticated: boolean, user?: object, error?: string}>}
 */
async function authenticate(event) {
  const token = extractToken(event.headers)
  
  if (!token) {
    return {
      authenticated: false,
      error: 'No authentication token provided',
    }
  }

  const result = await verifyToken(token)
  
  if (!result.valid) {
    return {
      authenticated: false,
      error: result.error,
    }
  }

  return {
    authenticated: true,
    user: {
      cognitoId: result.cognitoId,
      email: result.email,
      payload: result.payload,
    },
  }
}

/**
 * Create an authenticated response wrapper
 * @param {Function} handler - The handler function to wrap
 * @returns {Function} - The wrapped handler
 */
function requireAuth(handler) {
  return async (event) => {
    const authResult = await authenticate(event)
    
    if (!authResult.authenticated) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: authResult.error,
        }),
      }
    }

    // Add user to event context
    event.user = authResult.user
    
    // Call the actual handler
    return handler(event)
  }
}

module.exports = {
  verifyToken,
  extractToken,
  authenticate,
  requireAuth,
}
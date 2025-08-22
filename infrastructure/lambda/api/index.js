// Basic API Lambda handler
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'us-east-1' })

// Cache for secrets to avoid repeated fetches
let secretsCache = {
  clientId: null,
  clientSecret: null,
  lastFetch: 0,
}

// Helper function to get secret value
async function getSecretValue(secretName) {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName })
    const response = await secretsClient.send(command)
    return response.SecretString
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error)
    throw error
  }
}

// Helper function to get Strava credentials (with caching)
async function getStravaCredentials() {
  const now = Date.now()
  const cacheExpiry = 5 * 60 * 1000 // 5 minutes

  // Return cached values if still valid
  if (secretsCache.clientId && secretsCache.clientSecret && now - secretsCache.lastFetch < cacheExpiry) {
    return {
      clientId: secretsCache.clientId,
      clientSecret: secretsCache.clientSecret,
    }
  }

  // Fetch from Secrets Manager
  try {
    const [clientId, clientSecret] = await Promise.all([
      getSecretValue(process.env.STRAVA_CLIENT_ID_SECRET_NAME),
      getSecretValue(process.env.STRAVA_CLIENT_SECRET_SECRET_NAME),
    ])

    // Update cache
    secretsCache = {
      clientId,
      clientSecret,
      lastFetch: now,
    }

    return { clientId, clientSecret }
  } catch (error) {
    console.error('Failed to fetch Strava credentials from Secrets Manager:', error)
    throw new Error('Unable to retrieve Strava credentials')
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2))

  const { httpMethod, path, pathParameters, queryStringParameters, body, headers } = event

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  }

  // Handle health check
  if (path === '/api/v1/health') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'healthy',
        environment: process.env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      }),
    }
  }

  // Handle Strava OAuth initiation
  if (path === '/api/v1/auth/strava' && httpMethod === 'GET') {
    try {
      const { clientId } = await getStravaCredentials()
      // Build the correct redirect URI
      // Custom domains don't include the stage in the path
      const redirectUri = `${process.env.API_BASE_URL}/api/v1/auth/strava/callback`
      
      // Log for debugging
      console.log('OAuth initiation - Redirect URI:', redirectUri)
      
      if (!clientId || clientId === 'PLACEHOLDER_CLIENT_ID') {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Strava client ID not configured',
            message: 'Please update the secret in AWS Secrets Manager'
          }),
        }
      }

      // Generate a random state for CSRF protection
      const state = Math.random().toString(36).substring(2, 15)
      
      const authorizationUrl = `https://www.strava.com/oauth/authorize?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=activity:read_all` +
        `&state=${state}`

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          authorizationUrl, 
          state,
          debug: {
            redirectUri,
            apiUrl: process.env.API_URL,
            apiBaseUrl: process.env.API_BASE_URL,
            stage: process.env.API_STAGE
          }
        }),
      }
    } catch (error) {
      console.error('Error in Strava OAuth initiation:', error)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
      }
    }
  }

  // Handle Strava OAuth callback
  if (path === '/api/v1/auth/strava/callback' && httpMethod === 'GET') {
    const code = queryStringParameters?.code
    const state = queryStringParameters?.state
    const error = queryStringParameters?.error

    // Handle user denial
    if (error) {
      console.log('User denied authorization:', error)
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.FRONTEND_URL}/?error=authorization_denied`,
        },
      }
    }

    if (!code) {
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.FRONTEND_URL}/?error=no_code`,
        },
      }
    }

    try {
      // Get Strava credentials from Secrets Manager
      const { clientId, clientSecret } = await getStravaCredentials()
      
      if (!clientId || !clientSecret || 
          clientId === 'PLACEHOLDER_CLIENT_ID' || 
          clientSecret === 'PLACEHOLDER_CLIENT_SECRET') {
        console.error('Strava credentials not properly configured in Secrets Manager')
        return {
          statusCode: 302,
          headers: {
            Location: `${process.env.FRONTEND_URL}/?error=config_error`,
          },
        }
      }

      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
        }),
      })

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status}`)
      }

      const tokenData = await tokenResponse.json()

      // Log user details to console as requested
      console.log('New Strava user connected:', {
        athleteId: tokenData.athlete?.id,
        firstName: tokenData.athlete?.firstname,
        lastName: tokenData.athlete?.lastname,
        username: tokenData.athlete?.username,
        profile: tokenData.athlete?.profile,
        city: tokenData.athlete?.city,
        state: tokenData.athlete?.state,
        country: tokenData.athlete?.country,
        accessToken: tokenData.access_token ? 'received' : 'missing',
        refreshToken: tokenData.refresh_token ? 'received' : 'missing',
        expiresAt: tokenData.expires_at,
        timestamp: new Date().toISOString(),
      })

      // TODO: Save user data to DynamoDB users table
      // For now, we just log the details as requested

      // Redirect to homepage with success message
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.FRONTEND_URL}/?connected=true`,
        },
      }
    } catch (error) {
      console.error('Error exchanging token:', error)
      return {
        statusCode: 302,
        headers: {
          Location: `${process.env.FRONTEND_URL}/?error=token_exchange_failed`,
        },
      }
    }
  }

  // Handle Strava webhook verification
  if (path === '/api/v1/webhook/strava' && httpMethod === 'GET') {
    const hubChallenge = queryStringParameters?.['hub.challenge']
    const hubVerifyToken = queryStringParameters?.['hub.verify_token']

    // TODO: Verify token matches your Strava app's verify token
    if (hubChallenge) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'hub.challenge': hubChallenge }),
      }
    }
  }

  // Route handling
  try {
    let response = {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Success' }),
    }

    // Parse body if present
    const requestBody = body ? JSON.parse(body) : null

    // Route to appropriate handler based on path and method
    switch (true) {
      // Users endpoints
      case path === '/api/v1/users' && httpMethod === 'GET':
        response.body = JSON.stringify({
          message: 'Get user profile',
          userId: event.requestContext?.authorizer?.claims?.sub,
        })
        break

      case path === '/api/v1/users' && httpMethod === 'PUT':
        response.body = JSON.stringify({
          message: 'Update user profile',
          data: requestBody,
        })
        break

      // Activities endpoints
      case path === '/api/v1/activities' && httpMethod === 'GET':
        response.body = JSON.stringify({
          message: 'Get activities',
          activities: [],
        })
        break

      case path === '/api/v1/activities' && httpMethod === 'POST':
        response.body = JSON.stringify({
          message: 'Create activity',
          activity: requestBody,
        })
        break

      // Challenges endpoints
      case path === '/api/v1/challenges' && httpMethod === 'GET':
        response.body = JSON.stringify({
          message: 'Get challenges',
          challenges: [],
        })
        break

      case path === '/api/v1/challenges' && httpMethod === 'POST':
        response.body = JSON.stringify({
          message: 'Create challenge',
          challenge: requestBody,
        })
        break

      // Leaderboard endpoint
      case path === '/api/v1/leaderboard' && httpMethod === 'GET':
        response.body = JSON.stringify({
          message: 'Get leaderboard',
          leaderboard: [],
        })
        break

      // Default 404
      default:
        response = {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Not Found',
            path: path,
            method: httpMethod,
          }),
        }
    }

    return response
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Internal Server Error',
        error: error.message,
      }),
    }
  }
}
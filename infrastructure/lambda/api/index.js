// Basic API Lambda handler
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')

// Initialize AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.REGION || 'us-east-1' })
const dynamoClient = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(dynamoClient)

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

// Helper function to save user data to DynamoDB
async function saveUserToDynamoDB(userData) {
  const now = new Date().toISOString()
  
  const item = {
    userId: String(userData.athlete.id), // Use athleteId as userId (primary key)
    stravaId: String(userData.athlete.id), // Also store as stravaId for GSI
    athleteId: userData.athlete.id, // Keep numeric athleteId for reference
    firstName: userData.athlete.firstname || '',
    lastName: userData.athlete.lastname || '',
    username: userData.athlete.username || '',
    profile: userData.athlete.profile || '',
    profileMedium: userData.athlete.profile_medium || '',
    city: userData.athlete.city || '',
    state: userData.athlete.state || '',
    country: userData.athlete.country || '',
    sex: userData.athlete.sex || '',
    premium: userData.athlete.premium || false,
    summit: userData.athlete.summit || false,
    accessToken: userData.access_token,
    refreshToken: userData.refresh_token,
    expiresAt: userData.expires_at,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await docClient.send(new PutCommand({
      TableName: process.env.USERS_TABLE,
      Item: item,
    }))
    console.log('User saved to DynamoDB:', { userId: item.userId, username: item.username })
    return item
  } catch (error) {
    console.error('Error saving user to DynamoDB:', error)
    throw error
  }
}

// Helper function to refresh Strava token
async function refreshStravaToken(userId) {
  try {
    // Get user from DynamoDB
    const getUserResult = await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId: String(userId) },
    }))

    if (!getUserResult.Item) {
      throw new Error(`User not found: ${userId}`)
    }

    const user = getUserResult.Item
    const { clientId, clientSecret } = await getStravaCredentials()

    // Call Strava refresh endpoint
    const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      }),
    })

    if (!refreshResponse.ok) {
      throw new Error(`Token refresh failed: ${refreshResponse.status}`)
    }

    const tokenData = await refreshResponse.json()

    // Update user in DynamoDB with new tokens
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId: String(userId) },
      UpdateExpression: 'SET accessToken = :accessToken, refreshToken = :refreshToken, expiresAt = :expiresAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':accessToken': tokenData.access_token,
        ':refreshToken': tokenData.refresh_token,
        ':expiresAt': tokenData.expires_at,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }))

    console.log('Token refreshed for user:', userId)
    return updateResult.Attributes
  } catch (error) {
    console.error('Error refreshing token:', error)
    throw error
  }
}

// Helper function to get valid Strava token (auto-refreshes if expired)
// Pass in the Strava athlete ID (which we use as userId)
async function getValidStravaToken(athleteId) {
  try {
    const userId = String(athleteId)
    
    // Get user from DynamoDB
    const getUserResult = await docClient.send(new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    }))

    if (!getUserResult.Item) {
      throw new Error(`User not found: ${userId}`)
    }

    const user = getUserResult.Item
    const now = Math.floor(Date.now() / 1000)
    
    // Check if token is expired or about to expire (5 minutes buffer)
    if (user.expiresAt <= now + 300) {
      console.log('Token expired or expiring soon, refreshing...')
      const updatedUser = await refreshStravaToken(userId)
      return updatedUser.accessToken
    }

    return user.accessToken
  } catch (error) {
    console.error('Error getting valid token:', error)
    throw error
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

      // Log user details to console
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

      // Save user data to DynamoDB
      try {
        await saveUserToDynamoDB(tokenData)
        console.log('User successfully saved to database')
      } catch (dbError) {
        console.error('Failed to save user to database:', dbError)
        // Continue anyway - user is authenticated, we just couldn't save to DB
      }

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

  // Handle Strava webhook verification (GET request)
  if (path === '/api/v1/webhook/strava' && httpMethod === 'GET') {
    const hubChallenge = queryStringParameters?.['hub.challenge']
    const hubVerifyToken = queryStringParameters?.['hub.verify_token']
    const hubMode = queryStringParameters?.['hub.mode']

    console.log('Webhook verification request:', {
      hubMode,
      hubVerifyToken,
      hubChallenge: hubChallenge ? 'present' : 'missing',
      expectedToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'configured' : 'not configured'
    })

    // Verify the token matches our configured verify token
    const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'fitnessfight-webhook-token'
    
    if (hubMode === 'subscribe' && hubVerifyToken === expectedToken && hubChallenge) {
      console.log('Webhook verification successful')
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'hub.challenge': hubChallenge }),
      }
    }

    console.error('Webhook verification failed:', {
      modeMatch: hubMode === 'subscribe',
      tokenMatch: hubVerifyToken === expectedToken,
      challengePresent: !!hubChallenge
    })
    
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid verification token' }),
    }
  }

  // Handle Strava webhook events (POST request)
  if (path === '/api/v1/webhook/strava' && httpMethod === 'POST') {
    try {
      const webhookEvent = body ? JSON.parse(body) : null
      
      console.log('Strava webhook event received:', JSON.stringify(webhookEvent, null, 2))
      
      if (!webhookEvent) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No event data provided' }),
        }
      }

      const { object_type, object_id, aspect_type, owner_id, subscription_id, event_time, updates } = webhookEvent

      // Log event details
      console.log('Webhook event details:', {
        objectType: object_type,
        objectId: object_id,
        aspectType: aspect_type,
        ownerId: owner_id,
        subscriptionId: subscription_id,
        eventTime: event_time,
        updates: updates,
        timestamp: new Date().toISOString()
      })

      // Handle different event types
      switch (aspect_type) {
        case 'create':
          console.log(`New ${object_type} created:`, {
            id: object_id,
            athleteId: owner_id,
            eventTime: new Date(event_time * 1000).toISOString()
          })
          // TODO: Fetch full activity details using the athlete's access token
          // TODO: Store activity in DynamoDB activities table
          break
          
        case 'update':
          console.log(`${object_type} updated:`, {
            id: object_id,
            athleteId: owner_id,
            updates: updates,
            eventTime: new Date(event_time * 1000).toISOString()
          })
          // TODO: Fetch updated activity details
          // TODO: Update activity in DynamoDB
          break
          
        case 'delete':
          console.log(`${object_type} deleted:`, {
            id: object_id,
            athleteId: owner_id,
            eventTime: new Date(event_time * 1000).toISOString()
          })
          // TODO: Mark activity as deleted in DynamoDB
          break
          
        default:
          console.log(`Unknown aspect type: ${aspect_type}`)
      }

      // Return success response to Strava
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          success: true,
          message: 'Webhook event processed',
          eventId: object_id
        }),
      }
    } catch (error) {
      console.error('Error processing webhook event:', error)
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to process webhook event' }),
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
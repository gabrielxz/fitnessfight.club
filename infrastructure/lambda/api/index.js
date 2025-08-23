// Basic API Lambda handler
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const { authenticate, requireAuth } = require('./auth')
const { rateLimitMiddleware } = require('./rateLimit')
const crypto = require('crypto')
const { startOfWeek, endOfWeek } = require('date-fns')

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
async function saveUserToDynamoDB(userData, cognitoId = null) {
  const now = new Date().toISOString()
  
  const item = {
    userId: String(userData.athlete.id), // Use athleteId as userId (primary key)
    stravaId: String(userData.athlete.id), // Also store as stravaId for GSI
    athleteId: userData.athlete.id, // Keep numeric athleteId for reference
    cognitoId: cognitoId || null, // Link to Cognito user if provided
    authProvider: cognitoId ? 'cognito' : 'strava', // Track auth method
    emailVerified: cognitoId ? true : false, // Cognito users have verified emails
    firstName: userData.athlete.firstname || '',
    lastName: userData.athlete.lastname || '',
    username: userData.athlete.username || '',
    email: userData.athlete.email || '', // Store email if available
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

// Helper function to fetch complete activity details from Strava
async function fetchStravaActivity(activityId, accessToken) {
  try {
    const response = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('UNAUTHORIZED')
      }
      throw new Error(`Failed to fetch activity: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching activity from Strava:', error)
    throw error
  }
}

// Helper function to save/update activity in DynamoDB
async function saveActivityToDynamoDB(activity, userId) {
  const now = new Date().toISOString()
  
  // Validate required fields
  if (!activity.id) {
    throw new Error('Activity ID is required')
  }
  
  if (!activity.start_date) {
    console.warn(`Activity ${activity.id} missing start_date, using current time`)
  }
  
  // Validate and sanitize numeric fields
  const validateNumber = (value, defaultValue = 0) => {
    const num = Number(value)
    return isNaN(num) || num < 0 ? defaultValue : num
  }
  
  const item = {
    userId: String(userId),
    activityId: String(activity.id),
    name: activity.name || 'Untitled Activity',
    type: activity.type || 'Workout',
    distance: validateNumber(activity.distance, 0), // meters
    duration: validateNumber(activity.moving_time, 0), // seconds
    elapsedTime: validateNumber(activity.elapsed_time, 0), // seconds
    startDate: activity.start_date || now,
    timestamp: activity.start_date ? Math.floor(new Date(activity.start_date).getTime() / 1000) : Math.floor(Date.now() / 1000),
    averageSpeed: validateNumber(activity.average_speed, 0),
    maxSpeed: validateNumber(activity.max_speed, 0),
    averageHeartrate: activity.average_heartrate ? validateNumber(activity.average_heartrate, null) : null,
    maxHeartrate: activity.max_heartrate ? validateNumber(activity.max_heartrate, null) : null,
    elevationGain: validateNumber(activity.total_elevation_gain, 0),
    clubId: 'default', // For future club support
    createdAt: now,
    updatedAt: now,
  }
  
  // Validate timestamp is reasonable (not in the future, not before 2000)
  const minTimestamp = 946684800 // Jan 1, 2000
  const maxTimestamp = Math.floor(Date.now() / 1000) + 86400 // Allow 1 day in future for timezone issues
  if (item.timestamp < minTimestamp || item.timestamp > maxTimestamp) {
    console.warn(`Activity ${activity.id} has invalid timestamp: ${item.timestamp}, using current time`)
    item.timestamp = Math.floor(Date.now() / 1000)
  }

  try {
    await docClient.send(new PutCommand({
      TableName: process.env.ACTIVITIES_TABLE,
      Item: item,
    }))
    console.log('Activity saved to DynamoDB:', { userId: item.userId, activityId: item.activityId, name: item.name })
    return item
  } catch (error) {
    console.error('Error saving activity to DynamoDB:', error)
    throw error
  }
}

// Helper function to delete activity from DynamoDB
async function deleteActivityFromDynamoDB(activityId, userId) {
  try {
    await docClient.send(new DeleteCommand({
      TableName: process.env.ACTIVITIES_TABLE,
      Key: {
        userId: String(userId),
        activityId: String(activityId),
      },
    }))
    console.log('Activity deleted from DynamoDB:', { userId, activityId })
    return true
  } catch (error) {
    console.error('Error deleting activity from DynamoDB:', error)
    throw error
  }
}

exports.handler = async (event) => {
  // Only log full event in dev environment
  if (process.env.ENVIRONMENT === 'dev') {
    console.log('Event:', JSON.stringify(event, null, 2))
  } else {
    // Production: log minimal info
    console.log('Request:', { method: event.httpMethod, path: event.path })
  }

  const { httpMethod, path, pathParameters, queryStringParameters, body, headers } = event

  // Determine allowed origin based on environment
  const allowedOrigin = process.env.ENVIRONMENT === 'prod' 
    ? 'https://fitnessfight.club'
    : 'https://dev.fitnessfight.club'
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
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

  // Handle Strava OAuth initiation (requires authentication)
  if (path === '/api/v1/auth/strava' && httpMethod === 'GET') {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(event, 'default')
    if (rateLimitResult.statusCode === 429) {
      return { ...rateLimitResult, headers: { ...corsHeaders, ...rateLimitResult.headers } }
    }

    // Check if user is authenticated
    const authResult = await authenticate(event)
    if (!authResult.authenticated) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Authentication required',
          message: 'Please sign in to connect your Strava account'
        }),
      }
    }

    const cognitoId = authResult.user.cognitoId
    
    // Check if user already has Strava connected
    try {
      const existingUser = await docClient.send(new QueryCommand({
        TableName: process.env.USERS_TABLE,
        IndexName: 'cognitoId-index',
        KeyConditionExpression: 'cognitoId = :cognitoId',
        ExpressionAttributeValues: {
          ':cognitoId': cognitoId,
        },
        Limit: 1,
      }))

      if (existingUser.Items && existingUser.Items.length > 0 && existingUser.Items[0].stravaId) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'Strava already connected',
            stravaConnected: true,
            athleteId: existingUser.Items[0].athleteId,
          }),
        }
      }
    } catch (error) {
      console.error('Error checking existing Strava connection:', error)
    }

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

      // Generate secure state parameter with encrypted Cognito ID
      const stateNonce = Math.random().toString(36).substring(2, 15)
      const stateData = JSON.stringify({ cognitoId, nonce: stateNonce })
      
      // Create a deterministic key from environment variable
      const encryptionKey = crypto.scryptSync(
        process.env.USER_POOL_ID || 'default-key',
        'fitnessfight-salt',
        32
      )
      
      // Encrypt the state data
      const iv = crypto.randomBytes(16)
      const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv)
      let encrypted = cipher.update(stateData, 'utf8', 'base64url')
      encrypted += cipher.final('base64url')
      const authTag = cipher.getAuthTag().toString('base64url')
      
      // Combine IV, encrypted data, and auth tag
      const state = `${iv.toString('base64url')}.${encrypted}.${authTag}`
      
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

      // Decrypt and extract Cognito ID from secure state
      let cognitoId = null
      if (state && state.includes('.')) {
        try {
          const [ivStr, encrypted, authTag] = state.split('.')
          
          // Recreate the encryption key
          const encryptionKey = crypto.scryptSync(
            process.env.USER_POOL_ID || 'default-key',
            'fitnessfight-salt',
            32
          )
          
          // Decrypt the state
          const iv = Buffer.from(ivStr, 'base64url')
          const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv)
          decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
          
          let decrypted = decipher.update(encrypted, 'base64url', 'utf8')
          decrypted += decipher.final('utf8')
          
          const stateData = JSON.parse(decrypted)
          cognitoId = stateData.cognitoId
        } catch (error) {
          console.warn('Failed to decrypt state parameter:', error.message)
        }
      }

      // Save user data to DynamoDB with Cognito ID linkage
      try {
        await saveUserToDynamoDB(tokenData, cognitoId)
        console.log('User successfully saved to database with Cognito ID:', cognitoId || 'none')
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
      // Parse the webhook payload with proper error handling
      let webhookEvent
      try {
        webhookEvent = body ? JSON.parse(body) : null
      } catch (parseError) {
        console.error('Invalid JSON in webhook body:', parseError)
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid request body' }),
        }
      }
      
      // Validate webhook signature for security (if provided by Strava)
      // Strava sends a signature in the 'hub.signature' header for webhook validation
      const signature = headers['hub.signature'] || headers['Hub-Signature']
      if (signature && process.env.STRAVA_CLIENT_SECRET_SECRET_NAME) {
        try {
          const { clientSecret } = await getStravaCredentials()
          const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', clientSecret)
            .update(body || '')
            .digest('hex')
          
          if (signature !== expectedSignature) {
            console.error('Invalid webhook signature')
            return {
              statusCode: 401,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'Invalid signature' }),
            }
          }
        } catch (sigError) {
          console.error('Error validating webhook signature:', sigError)
          // Continue processing even if signature validation fails (for backward compatibility)
        }
      }
      
      console.log('Strava webhook event received:', JSON.stringify(webhookEvent, null, 2))
      
      if (!webhookEvent) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No event data provided' }),
        }
      }

      const { object_type, object_id, aspect_type, owner_id, subscription_id, event_time, updates } = webhookEvent

      // Validate required webhook fields
      if (!object_type || !object_id || !aspect_type || !owner_id) {
        console.error('Missing required webhook fields:', { object_type, object_id, aspect_type, owner_id })
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required webhook fields' }),
        }
      }

      // Validate field types and ranges
      if (typeof object_id !== 'number' || object_id <= 0) {
        console.error('Invalid object_id:', object_id)
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid object_id' }),
        }
      }

      if (typeof owner_id !== 'number' || owner_id <= 0) {
        console.error('Invalid owner_id:', owner_id)
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid owner_id' }),
        }
      }

      // Log event details (only in dev environment)
      if (process.env.ENVIRONMENT === 'dev') {
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
      } else {
        // Production: log minimal info
        console.log('Webhook event:', { type: object_type, aspect: aspect_type, id: object_id })
      }

      // Only process activity events
      if (object_type !== 'activity') {
        console.log(`Ignoring non-activity event: ${object_type}`)
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            success: true,
            message: 'Non-activity event ignored',
          }),
        }
      }

      // Handle different event types
      switch (aspect_type) {
        case 'create':
        case 'update':
          try {
            console.log(`${aspect_type === 'create' ? 'New' : 'Updated'} activity:`, {
              id: object_id,
              athleteId: owner_id,
              eventTime: new Date(event_time * 1000).toISOString()
            })

            // Get valid access token for the athlete
            const accessToken = await getValidStravaToken(owner_id)
            
            // Fetch complete activity details from Strava
            const activity = await fetchStravaActivity(object_id, accessToken)
            
            // Save/update activity in DynamoDB
            await saveActivityToDynamoDB(activity, owner_id)
            
            console.log(`Activity ${aspect_type}d successfully:`, object_id)
          } catch (error) {
            console.error(`Failed to process ${aspect_type} event:`, error)
            
            // If token is invalid, try to refresh
            if (error.message === 'UNAUTHORIZED') {
              try {
                console.log('Token expired, attempting refresh...')
                const updatedUser = await refreshStravaToken(owner_id)
                const activity = await fetchStravaActivity(object_id, updatedUser.accessToken)
                await saveActivityToDynamoDB(activity, owner_id)
                console.log(`Activity ${aspect_type}d successfully after token refresh:`, object_id)
              } catch (refreshError) {
                console.error('Failed even after token refresh:', refreshError)
              }
            }
          }
          break
          
        case 'delete':
          try {
            console.log(`Activity deleted:`, {
              id: object_id,
              athleteId: owner_id,
              eventTime: new Date(event_time * 1000).toISOString()
            })
            
            // Delete activity from DynamoDB
            await deleteActivityFromDynamoDB(object_id, owner_id)
            
            console.log('Activity deleted successfully:', object_id)
          } catch (error) {
            console.error('Failed to delete activity:', error)
          }
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
    
    // Check authentication for protected endpoints
    const protectedPaths = [
      '/api/v1/users',
      '/api/v1/activities',
      '/api/v1/challenges'
    ]
    
    const requiresAuth = protectedPaths.some(p => path.startsWith(p)) && 
                        httpMethod !== 'GET' || // Write operations require auth
                        path.startsWith('/api/v1/users') || // User endpoints always require auth
                        path.startsWith('/api/v1/activities') // Activities require auth
    
    let authUser = null
    if (requiresAuth) {
      const authResult = await authenticate(event)
      if (!authResult.authenticated) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Unauthorized',
            message: authResult.error || 'Authentication required',
          }),
        }
      }
      authUser = authResult.user
    }

    // Route to appropriate handler based on path and method
    switch (true) {
      // Weekly stats endpoint
      case path.match(/\/api\/v1\/users\/([^/]+)\/weekly-stats/) !== null && httpMethod === 'GET':
        const userIdMatch = path.match(/\/api\/v1\/users\/([^/]+)\/weekly-stats/)
        const requestedUserId = userIdMatch ? userIdMatch[1] : null
        
        if (!requestedUserId) {
          response = {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Bad Request',
              message: 'User ID is required',
            }),
          }
          break
        }

        // Verify the user is requesting their own data or has appropriate permissions
        if (authUser) {
          // Get the user's Strava ID from their Cognito ID
          const userQuery = await docClient.send(new QueryCommand({
            TableName: process.env.USERS_TABLE,
            IndexName: 'cognitoId-index',
            KeyConditionExpression: 'cognitoId = :cognitoId',
            ExpressionAttributeValues: {
              ':cognitoId': authUser.cognitoId,
            },
            Limit: 1,
          }))
          
          const currentUser = userQuery.Items && userQuery.Items[0] ? userQuery.Items[0] : null
          
          // Check if user is requesting their own data
          if (!currentUser || currentUser.userId !== requestedUserId) {
            response = {
              statusCode: 403,
              headers: corsHeaders,
              body: JSON.stringify({
                error: 'Forbidden',
                message: 'You can only view your own stats',
              }),
            }
            break
          }
        } else {
          response = {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Unauthorized',
              message: 'Authentication required',
            }),
          }
          break
        }

        try {
          // Calculate current week boundaries (Monday to Sunday)
          const now = new Date()
          const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 })     // Sunday 23:59:59
          
          // Convert to Unix timestamps for DynamoDB query
          const startTimestamp = Math.floor(weekStart.getTime() / 1000)
          const endTimestamp = Math.floor(weekEnd.getTime() / 1000)
          
          console.log('Querying activities for week:', {
            userId: requestedUserId,
            weekStart: weekStart.toISOString(),
            weekEnd: weekEnd.toISOString(),
            startTimestamp,
            endTimestamp,
          })
          
          // Query activities for the current week using GSI with pagination
          let allActivities = []
          let lastEvaluatedKey = null
          let queryCount = 0
          const maxQueries = 10 // Prevent infinite loops
          
          do {
            const queryParams = {
              TableName: process.env.ACTIVITIES_TABLE,
              IndexName: 'userId-timestamp-index',
              KeyConditionExpression: 'userId = :userId AND #ts BETWEEN :start AND :end',
              ExpressionAttributeNames: {
                '#ts': 'timestamp',
              },
              ExpressionAttributeValues: {
                ':userId': requestedUserId,
                ':start': startTimestamp,
                ':end': endTimestamp,
              },
              Limit: 100, // Query up to 100 items per request
            }
            
            // Add pagination key if we have one
            if (lastEvaluatedKey) {
              queryParams.ExclusiveStartKey = lastEvaluatedKey
            }
            
            const activitiesQuery = await docClient.send(new QueryCommand(queryParams))
            
            if (activitiesQuery.Items) {
              allActivities = allActivities.concat(activitiesQuery.Items)
            }
            
            lastEvaluatedKey = activitiesQuery.LastEvaluatedKey
            queryCount++
            
            // Log pagination progress in dev
            if (process.env.ENVIRONMENT === 'dev' && lastEvaluatedKey) {
              console.log(`Pagination: Retrieved ${allActivities.length} activities so far, continuing...`)
            }
          } while (lastEvaluatedKey && queryCount < maxQueries)
          
          if (queryCount >= maxQueries) {
            console.warn(`Weekly stats query hit max pagination limit for user ${requestedUserId}`)
          }
          
          // Calculate total duration in hours
          const activities = allActivities
          const totalSeconds = activities.reduce((sum, activity) => sum + (activity.duration || 0), 0)
          const totalHours = Math.round((totalSeconds / 3600) * 10) / 10 // Round to 1 decimal place
          
          // Format week range for display
          const weekRangeStart = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const weekRangeEnd = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const weekRange = `${weekRangeStart} - ${weekRangeEnd}`
          
          response.body = JSON.stringify({
            success: true,
            userId: requestedUserId,
            weekRange,
            totalHours,
            activityCount: activities.length,
            activities: activities.map(a => ({
              activityId: a.activityId,
              name: a.name,
              type: a.type,
              duration: a.duration,
              distance: a.distance,
              startDate: a.startDate,
            })),
          })
        } catch (error) {
          console.error('Error fetching weekly stats:', error)
          response = {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Internal Server Error',
              message: 'Failed to fetch weekly stats',
            }),
          }
        }
        break

      // Users endpoints (all require authentication)
      case path === '/api/v1/users' && httpMethod === 'GET':
        // Get user profile from Cognito ID
        const userQuery = await docClient.send(new QueryCommand({
          TableName: process.env.USERS_TABLE,
          IndexName: 'cognitoId-index',
          KeyConditionExpression: 'cognitoId = :cognitoId',
          ExpressionAttributeValues: {
            ':cognitoId': authUser.cognitoId,
          },
          Limit: 1,
        }))
        
        response.body = JSON.stringify({
          success: true,
          user: userQuery.Items && userQuery.Items[0] ? userQuery.Items[0] : null,
          cognitoId: authUser.cognitoId,
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
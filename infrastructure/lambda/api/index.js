// Basic API Lambda handler
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
/**
 * AWS CloudFormation Custom Resource handler for Strava Webhook Subscription
 * 
 * This Lambda function automatically manages Strava webhook subscriptions
 * as part of the CDK stack lifecycle (Create/Update/Delete).
 */

const https = require('https')
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager')

// Initialize AWS clients
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' })

/**
 * CloudFormation Custom Resource handler
 */
exports.handler = async (event, context) => {
  console.log('Custom Resource Event:', JSON.stringify(event, null, 2))
  
  const { RequestType, ResourceProperties, PhysicalResourceId, RequestId, StackId, LogicalResourceId } = event
  
  // Extract properties
  const {
    ClientIdSecretName,
    ClientSecretSecretName,
    CallbackUrl,
    VerifyToken,
    Environment
  } = ResourceProperties
  
  let responseData = {}
  let physicalResourceId = PhysicalResourceId || `strava-webhook-${Environment}-${Date.now()}`
  
  try {
    // Get Strava credentials from Secrets Manager
    const [clientId, clientSecret] = await Promise.all([
      getSecretValue(ClientIdSecretName),
      getSecretValue(ClientSecretSecretName)
    ])
    
    switch (RequestType) {
      case 'Create':
      case 'Update':
        // For both Create and Update, we'll ensure a valid subscription exists
        const subscriptionId = await ensureWebhookSubscription(
          clientId,
          clientSecret,
          CallbackUrl,
          VerifyToken,
          Environment
        )
        
        responseData = {
          SubscriptionId: subscriptionId,
          CallbackUrl: CallbackUrl,
          Message: `Webhook subscription ${RequestType.toLowerCase()}d successfully`
        }
        
        // Use subscription ID as physical resource ID for tracking
        physicalResourceId = `strava-webhook-${Environment}-${subscriptionId}`
        break
        
      case 'Delete':
        // Delete all existing subscriptions for this app
        await deleteAllSubscriptions(clientId, clientSecret, Environment)
        responseData = {
          Message: 'Webhook subscription deleted successfully'
        }
        break
        
      default:
        throw new Error(`Unknown request type: ${RequestType}`)
    }
    
    await sendResponse(event, context, 'SUCCESS', responseData, physicalResourceId)
    
  } catch (error) {
    console.error('Error handling custom resource:', error)
    await sendResponse(event, context, 'FAILED', { Error: error.message }, physicalResourceId)
  }
}

/**
 * Get secret value from AWS Secrets Manager
 */
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

/**
 * Make HTTPS request to Strava API
 */
function makeStravaRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = ''
      
      res.on('data', (chunk) => {
        body += chunk
      })
      
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          }
          resolve(response)
        } catch (error) {
          reject(error)
        }
      })
    })
    
    req.on('error', reject)
    
    if (data) {
      req.write(data)
    }
    
    req.end()
  })
}

/**
 * Get existing webhook subscriptions
 */
async function getSubscriptions(clientId, clientSecret) {
  const options = {
    hostname: 'www.strava.com',
    path: `/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  const response = await makeStravaRequest(options)
  
  if (response.statusCode !== 200) {
    console.error('Failed to get subscriptions:', response.body)
    throw new Error(`Failed to get subscriptions: ${response.statusCode}`)
  }
  
  return response.body || []
}

/**
 * Delete a webhook subscription
 */
async function deleteSubscription(subscriptionId, clientId, clientSecret) {
  const options = {
    hostname: 'www.strava.com',
    path: `/api/v3/push_subscriptions/${subscriptionId}?client_id=${clientId}&client_secret=${clientSecret}`,
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  const response = await makeStravaRequest(options)
  
  if (response.statusCode !== 204) {
    console.error(`Failed to delete subscription ${subscriptionId}:`, response.body)
    // Don't throw error for delete failures, just log
  } else {
    console.log(`Deleted subscription ${subscriptionId}`)
  }
}

/**
 * Create a new webhook subscription
 */
async function createSubscription(clientId, clientSecret, callbackUrl, verifyToken) {
  const postData = JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken
  })
  
  const options = {
    hostname: 'www.strava.com',
    path: '/api/v3/push_subscriptions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }
  
  const response = await makeStravaRequest(options, postData)
  
  if (response.statusCode !== 201) {
    console.error('Failed to create subscription:', response.body)
    throw new Error(`Failed to create subscription: ${response.statusCode} - ${JSON.stringify(response.body)}`)
  }
  
  return response.body.id
}

/**
 * Ensure a valid webhook subscription exists
 * Deletes old subscriptions and creates a new one
 */
async function ensureWebhookSubscription(clientId, clientSecret, callbackUrl, verifyToken, environment) {
  console.log(`Ensuring webhook subscription for ${environment} environment`)
  console.log(`Callback URL: ${callbackUrl}`)
  
  // Check for existing subscriptions
  const existingSubscriptions = await getSubscriptions(clientId, clientSecret)
  console.log(`Found ${existingSubscriptions.length} existing subscription(s)`)
  
  // Check if we already have the correct subscription
  for (const sub of existingSubscriptions) {
    if (sub.callback_url === callbackUrl) {
      console.log(`Existing subscription found with correct callback URL: ${sub.id}`)
      return sub.id
    }
  }
  
  // Delete all existing subscriptions (they have wrong callback URLs)
  for (const sub of existingSubscriptions) {
    console.log(`Deleting outdated subscription ${sub.id} (${sub.callback_url})`)
    await deleteSubscription(sub.id, clientId, clientSecret)
  }
  
  // Create new subscription
  console.log('Creating new webhook subscription...')
  const subscriptionId = await createSubscription(clientId, clientSecret, callbackUrl, verifyToken)
  console.log(`Created new subscription: ${subscriptionId}`)
  
  return subscriptionId
}

/**
 * Delete all existing subscriptions
 */
async function deleteAllSubscriptions(clientId, clientSecret, environment) {
  console.log(`Deleting all webhook subscriptions for ${environment} environment`)
  
  const existingSubscriptions = await getSubscriptions(clientId, clientSecret)
  console.log(`Found ${existingSubscriptions.length} subscription(s) to delete`)
  
  for (const sub of existingSubscriptions) {
    await deleteSubscription(sub.id, clientId, clientSecret)
  }
  
  console.log('All subscriptions deleted')
}

/**
 * Send response back to CloudFormation
 */
async function sendResponse(event, context, responseStatus, responseData, physicalResourceId) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: physicalResourceId,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData
  })
  
  console.log('Response:', responseBody)
  
  const parsedUrl = new URL(event.ResponseURL)
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'PUT',
    headers: {
      'Content-Type': '',
      'Content-Length': responseBody.length
    }
  }
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      console.log(`CloudFormation response status: ${res.statusCode}`)
      resolve()
    })
    
    req.on('error', (error) => {
      console.error('Error sending response to CloudFormation:', error)
      reject(error)
    })
    
    req.write(responseBody)
    req.end()
  })
}
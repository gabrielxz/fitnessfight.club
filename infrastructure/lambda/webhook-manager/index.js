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
 * CloudFormation Custom Resource handler for CDK Provider
 * Returns attributes directly (Provider framework wraps them)
 */
exports.handler = async (event, context) => {
  console.log('Custom Resource Event:', JSON.stringify(event, null, 2))
  
  const { RequestType, ResourceProperties, PhysicalResourceId } = event
  
  // Extract properties
  const {
    ClientIdSecretName,
    ClientSecretSecretName,
    CallbackUrl,
    VerifyToken,
    Environment
  } = ResourceProperties || {}
  
  // Use existing physical resource ID or create new one
  const physicalResourceId = PhysicalResourceId || `strava-webhook-${Environment}-${Date.now()}`
  
  try {
    // Get Strava credentials from Secrets Manager
    let clientId, clientSecret
    try {
      [clientId, clientSecret] = await Promise.all([
        getSecretValue(ClientIdSecretName),
        getSecretValue(ClientSecretSecretName)
      ])
    } catch (secretError) {
      console.error('Failed to retrieve Strava credentials:', secretError)
      // Return with placeholder to allow deployment to continue
      return {
        physicalResourceId,
        SubscriptionId: 'placeholder-no-credentials',
        CallbackUrl: CallbackUrl || '',
        Message: 'Webhook subscription skipped - Strava credentials not configured'
      }
    }
    
    // Check if credentials are still placeholders
    if (!clientId || !clientSecret || 
        clientId === 'PLACEHOLDER_CLIENT_ID' || 
        clientSecret === 'PLACEHOLDER_CLIENT_SECRET') {
      console.log('Strava credentials are placeholders, skipping webhook subscription')
      return {
        physicalResourceId,
        SubscriptionId: 'placeholder-pending-config',
        CallbackUrl: CallbackUrl || '',
        Message: 'Webhook subscription pending - awaiting Strava credential configuration'
      }
    }
    
    if (RequestType === 'Delete') {
      // Delete all existing subscriptions for this app
      try {
        await deleteAllSubscriptions(clientId, clientSecret, Environment)
      } catch (deleteError) {
        console.error('Error during deletion (non-critical):', deleteError)
      }
      
      return {
        physicalResourceId,
        SubscriptionId: 'deleted',
        Message: 'Webhook subscription deleted'
      }
    }
    
    // For Create and Update
    let subscriptionId
    try {
      subscriptionId = await ensureWebhookSubscription(
        clientId,
        clientSecret,
        CallbackUrl,
        VerifyToken,
        Environment
      )
    } catch (subscriptionError) {
      console.error('Failed to create/update webhook subscription:', subscriptionError)
      // Return with error info to allow deployment to continue
      return {
        physicalResourceId,
        SubscriptionId: 'error-subscription-failed',
        CallbackUrl: CallbackUrl || '',
        Message: `Webhook subscription failed: ${subscriptionError.message}`
      }
    }
    
    // Success - return the subscription ID
    return {
      physicalResourceId: `strava-webhook-${Environment}-${subscriptionId}`,
      SubscriptionId: String(subscriptionId),
      CallbackUrl: CallbackUrl || '',
      Message: `Webhook subscription ${RequestType.toLowerCase()}d successfully`
    }
    
  } catch (error) {
    console.error('Error handling custom resource:', error)
    // Return error state but don't throw (allows deployment to continue)
    return {
      physicalResourceId,
      SubscriptionId: 'error-unexpected',
      Message: `Unexpected error: ${error.message}`
    }
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

// sendResponse function removed - CDK Provider framework handles CloudFormation responses
#!/usr/bin/env node

/**
 * Idempotent Strava Webhook Subscription Script
 * 
 * This script manages Strava webhook subscriptions for the Fitness Fight Club application.
 * It checks for existing subscriptions and only creates new ones if needed.
 * 
 * Usage: node strava-webhook-subscribe.js [dev|prod]
 */

const https = require('https')
const { 
  SecretsManagerClient, 
  GetSecretValueCommand 
} = require('@aws-sdk/client-secrets-manager')
const { 
  CloudFormationClient, 
  DescribeStacksCommand 
} = require('@aws-sdk/client-cloudformation')

// Parse command line arguments
const environment = process.argv[2]
if (!environment || !['dev', 'prod'].includes(environment)) {
  console.error('Usage: node strava-webhook-subscribe.js [dev|prod]')
  process.exit(1)
}

// AWS Configuration
const region = 'us-east-1'
const secretsClient = new SecretsManagerClient({ region })
const cfnClient = new CloudFormationClient({ region })

// Stack name based on environment
const stackName = `fitnessfight-club-${environment}-Stack`

// Webhook configuration
const callbackUrl = environment === 'dev' 
  ? 'https://api.dev.fitnessfight.club/api/v1/webhook/strava'
  : 'https://api.fitnessfight.club/api/v1/webhook/strava'

/**
 * Get secret value from AWS Secrets Manager
 */
async function getSecretValue(secretName) {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName })
    const response = await secretsClient.send(command)
    return response.SecretString
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error.message)
    throw error
  }
}

/**
 * Get CloudFormation stack outputs
 */
async function getStackOutputs() {
  try {
    const command = new DescribeStacksCommand({ StackName: stackName })
    const response = await cfnClient.send(command)
    const stack = response.Stacks[0]
    
    const outputs = {}
    for (const output of stack.Outputs || []) {
      outputs[output.OutputKey] = output.OutputValue
    }
    
    return outputs
  } catch (error) {
    console.error(`Error fetching stack outputs for ${stackName}:`, error.message)
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
          let parsedBody = null
          
          // Only try to parse JSON if we got a successful response or if it looks like JSON
          if (body) {
            if (res.headers['content-type']?.includes('application/json') || body.trim().startsWith('[') || body.trim().startsWith('{')) {
              try {
                parsedBody = JSON.parse(body)
              } catch (e) {
                // If JSON parsing fails, return the raw body
                console.error('Failed to parse response as JSON:', body.substring(0, 200))
                parsedBody = body
              }
            } else {
              parsedBody = body
            }
          }
          
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody
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
  console.log('Checking existing webhook subscriptions...')
  
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
    const errorMessage = typeof response.body === 'string' 
      ? `HTML Error Page: ${response.body.substring(0, 200)}...`
      : JSON.stringify(response.body)
    throw new Error(`Failed to get subscriptions: ${response.statusCode} - ${errorMessage}`)
  }
  
  // Handle both array response and error cases
  if (!Array.isArray(response.body)) {
    console.error('Unexpected response format:', response.body)
    return []
  }
  
  return response.body || []
}

/**
 * Create a new webhook subscription
 */
async function createSubscription(clientId, clientSecret, verifyToken) {
  console.log('Creating new webhook subscription...')
  
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
    throw new Error(`Failed to create subscription: ${response.statusCode} - ${JSON.stringify(response.body)}`)
  }
  
  return response.body
}

/**
 * Main function
 */
async function main() {
  console.log(`\n🚀 Strava Webhook Subscription Manager`)
  console.log(`Environment: ${environment.toUpperCase()}`)
  console.log(`Callback URL: ${callbackUrl}`)
  console.log('=' + '='.repeat(59))
  
  try {
    // Step 1: Get credentials and configuration
    console.log('\n📋 Fetching credentials and configuration...')
    
    const [clientId, clientSecret, stackOutputs] = await Promise.all([
      getSecretValue(`fitnessfight-club-strava-client-id-${environment}`),
      getSecretValue(`fitnessfight-club-strava-client-secret-${environment}`),
      getStackOutputs()
    ])
    
    const verifyToken = stackOutputs.StravaWebhookVerifyToken
    
    if (!verifyToken) {
      throw new Error('Could not find StravaWebhookVerifyToken in stack outputs')
    }
    
    // Check if credentials are valid
    if (!clientId || !clientSecret || 
        clientId === 'PLACEHOLDER_CLIENT_ID' || 
        clientSecret === 'PLACEHOLDER_CLIENT_SECRET') {
      console.log('\n⚠️  WARNING: Strava credentials are not configured!')
      console.log('Please update the following secrets in AWS Secrets Manager:')
      console.log(`  - fitnessfight-club-strava-client-id-${environment}`)
      console.log(`  - fitnessfight-club-strava-client-secret-${environment}`)
      console.log('\nSkipping webhook subscription setup.')
      process.exit(0)
    }
    
    // Step 2: Check existing subscriptions
    console.log('\n📋 Checking for existing subscriptions...')
    
    const existingSubscriptions = await getSubscriptions(clientId, clientSecret)
    
    if (existingSubscriptions && existingSubscriptions.length > 0) {
      console.log(`Found ${existingSubscriptions.length} existing subscription(s):`)
      
      // Check if we already have the correct subscription
      for (const sub of existingSubscriptions) {
        console.log(`  - ID: ${sub.id}, Callback: ${sub.callback_url}`)
        
        if (sub.callback_url === callbackUrl) {
          console.log('\n✅ Webhook subscription already exists!')
          console.log(`Subscription ID: ${sub.id}`)
          console.log(`Created: ${new Date(sub.created_at).toLocaleString()}`)
          console.log(`Updated: ${new Date(sub.updated_at).toLocaleString()}`)
          console.log('\nNo action needed - webhook is already configured.')
          process.exit(0)
        }
      }
      
      console.log('\n⚠️  Existing subscriptions found but none match our callback URL.')
    } else {
      console.log('No existing subscriptions found.')
    }
    
    // Step 3: Create new subscription
    console.log('\n📋 Creating new webhook subscription...')
    
    const newSubscription = await createSubscription(clientId, clientSecret, verifyToken)
    
    console.log('\n✅ Webhook subscription created successfully!')
    console.log(`Subscription ID: ${newSubscription.id}`)
    console.log(`Callback URL: ${callbackUrl}`)
    console.log(`Verify Token: ${verifyToken}`)
    
    // Step 4: Verify the subscription
    console.log('\n📋 Verifying subscription...')
    
    const verifySubscriptions = await getSubscriptions(clientId, clientSecret)
    const verified = verifySubscriptions.some(sub => sub.id === newSubscription.id)
    
    if (verified) {
      console.log('✅ Subscription verified successfully!')
    } else {
      console.log('⚠️  Warning: Could not verify subscription')
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('✨ Webhook subscription setup complete!')
    console.log(`\nYour webhook endpoint is now ready to receive Strava activity events.`)
    console.log(`Subscription ID: ${newSubscription.id}`)
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    
    if (error.message.includes('ValidationError')) {
      console.error('\n⚠️  This might be because:')
      console.error('  1. Another subscription already exists for this app')
      console.error('  2. The callback URL is not accessible')
      console.error('  3. Your Strava app settings need updating')
    }
    
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
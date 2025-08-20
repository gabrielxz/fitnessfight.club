#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { FitnessFightStack } from '../lib/fitnessfight-stack'
import { CertificateStack } from '../lib/certificate-stack'
import { getConfig } from '../lib/config'

const app = new cdk.App()

// Get environment from context or environment variable
const getEnvironment = (): 'dev' | 'prod' => {
  const env = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev'
  if (env !== 'dev' && env !== 'prod') {
    throw new Error(`Invalid environment: ${env}. Must be 'dev' or 'prod'.`)
  }
  return env as 'dev' | 'prod'
}

const environment = getEnvironment()
const config = getConfig(environment)

// Common environment configuration
const envConfig = {
  region: 'us-east-1', // Required for CloudFront and ACM certificates
  account: process.env.CDK_DEFAULT_ACCOUNT,
}

// Common tags
const commonTags = {
  Project: 'fitnessfight.club',
  Environment: environment,
  ManagedBy: 'CDK',
}

// Create certificate stack first (must be in us-east-1 for CloudFront)
const certificateStack = new CertificateStack(app, `fitnessfight-club-${environment}-Certificate`, {
  environment,
  hostedZoneId: config.hostedZoneId,
  domainName: config.domainName,
  env: envConfig,
  tags: commonTags,
  description: `ACM Certificate for fitnessfight.club ${environment} environment`,
})

// Create main stack with dependency on certificate stack
const mainStack = new FitnessFightStack(app, `fitnessfight-club-${environment}-Stack`, {
  environment,
  env: envConfig,
  tags: commonTags,
  description: `Fitness Fight Club infrastructure stack for ${environment} environment`,
})

// Add explicit dependency - main stack depends on certificate stack
mainStack.addDependency(certificateStack)

app.synth()

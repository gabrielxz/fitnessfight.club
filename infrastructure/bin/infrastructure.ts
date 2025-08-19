#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { FitnessFightStack } from '../lib/fitnessfight-stack'

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
const stackName = `fitnessfight-club-${environment}-Stack`

// Create the stack with environment-specific configuration
new FitnessFightStack(app, stackName, {
  environment,
  env: {
    // Use us-east-1 for CloudFront distribution
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  tags: {
    Project: 'fitnessfight.club',
    Environment: environment,
  },
  description: `Fitness Fight Club infrastructure stack for ${environment} environment`,
})

app.synth()

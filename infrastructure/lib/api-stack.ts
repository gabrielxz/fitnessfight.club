import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import * as path from 'path'
import { getConfig } from './config'

export interface ApiStackProps {
  environment: 'dev' | 'prod'
  usersTable: dynamodb.Table
  activitiesTable: dynamodb.Table
  challengesTable: dynamodb.Table
  userPool: cognito.UserPool
  userPoolClient: cognito.UserPoolClient
}

export class ApiStack extends Construct {
  public readonly api: apigateway.RestApi
  public readonly apiFunction: NodejsFunction
  public readonly webhookVerifyToken: string

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id)

    const { environment, usersTable, activitiesTable, challengesTable, userPool, userPoolClient } =
      props
    const config = getConfig(environment)

    // Determine frontend and API URLs based on environment
    const frontendUrl =
      environment === 'dev' ? 'https://dev.fitnessfight.club' : 'https://fitnessfight.club'

    const apiUrl =
      environment === 'dev'
        ? 'https://api.dev.fitnessfight.club/api/v1'
        : 'https://api.fitnessfight.club/api/v1'

    // Base API domain for OAuth callbacks (includes stage name)
    const apiBaseUrl =
      environment === 'dev' ? 'https://api.dev.fitnessfight.club' : 'https://api.fitnessfight.club'

    // Create Secrets Manager secrets for Strava OAuth
    const stravaClientIdSecret = new secretsmanager.Secret(this, 'StravaClientId', {
      secretName: `fitnessfight-club-strava-client-id-${environment}`,
      description: `Strava OAuth Client ID for ${environment} environment`,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CLIENT_ID'),
    })

    const stravaClientSecretSecret = new secretsmanager.Secret(this, 'StravaClientSecret', {
      secretName: `fitnessfight-club-strava-client-secret-${environment}`,
      description: `Strava OAuth Client Secret for ${environment} environment`,
      secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_CLIENT_SECRET'),
    })

    // Reference existing Google client secret
    const googleClientSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleClientSecret',
      `fitnessfight-club-google-client-secret-${environment}`
    )

    // Generate a secure webhook verification token
    this.webhookVerifyToken = `fitnessfight-webhook-${environment}-${Math.random().toString(36).substring(2, 15)}`

    // Create Lambda function for API with bundled dependencies
    this.apiFunction = new NodejsFunction(this, 'ApiFunction', {
      functionName: `fitnessfight-club-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/api/index.js'),
      depsLockFilePath: path.join(__dirname, '../lambda/api/package-lock.json'),
      bundling: {
        minify: false, // Keep readable for debugging
        sourceMap: false, // Disable source maps for now
        forceDockerBundling: false,
        nodeModules: [
          'aws-jwt-verify',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb',
          '@aws-sdk/client-secrets-manager',
          '@aws-sdk/client-cognito-identity-provider',
          'date-fns',
        ],
      },
      environment: {
        ENVIRONMENT: environment,
        USERS_TABLE: usersTable.tableName,
        ACTIVITIES_TABLE: activitiesTable.tableName,
        CHALLENGES_TABLE: challengesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        REGION: cdk.Stack.of(this).region,
        FRONTEND_URL: frontendUrl,
        API_URL: apiUrl,
        API_BASE_URL: apiBaseUrl,
        API_STAGE: environment,
        STRAVA_CLIENT_ID_SECRET_NAME: stravaClientIdSecret.secretName,
        STRAVA_CLIENT_SECRET_SECRET_NAME: stravaClientSecretSecret.secretName,
        STRAVA_WEBHOOK_VERIFY_TOKEN: this.webhookVerifyToken,
        GOOGLE_CLIENT_SECRET_NAME: googleClientSecret.secretName,
        COGNITO_DOMAIN: `fitnessfight-club-${environment}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    })

    // Grant Lambda permissions to access DynamoDB tables
    usersTable.grantReadWriteData(this.apiFunction)
    activitiesTable.grantReadWriteData(this.apiFunction)
    challengesTable.grantReadWriteData(this.apiFunction)

    // Grant Lambda permissions to read Secrets Manager secrets
    stravaClientIdSecret.grantRead(this.apiFunction)
    stravaClientSecretSecret.grantRead(this.apiFunction)
    googleClientSecret.grantRead(this.apiFunction)

    // Import the hosted zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.domainName,
    })

    // Import the certificate from cross-stack reference
    const certificateArn = cdk.Fn.importValue(`fitnessfight-club-${environment}-certificate-arn`)
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)

    // API domain name
    const apiDomainName =
      environment === 'dev' ? `api.dev.${config.domainName}` : `api.${config.domainName}`

    // Create custom domain for API
    const customDomain = new apigateway.DomainName(this, 'ApiDomain', {
      domainName: apiDomainName,
      certificate,
      endpointType: apigateway.EndpointType.EDGE,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    })

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `fitnessfight-club-api-${environment}`,
      description: 'Fitness Fight Club API',
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        dataTraceEnabled: environment === 'dev',
        loggingLevel:
          environment === 'dev'
            ? apigateway.MethodLoggingLevel.INFO
            : apigateway.MethodLoggingLevel.ERROR,
      },
      defaultCorsPreflightOptions: {
        allowOrigins:
          environment === 'prod'
            ? ['https://fitnessfight.club', 'https://www.fitnessfight.club']
            : ['https://dev.fitnessfight.club', 'http://localhost:3000'],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `fitnessfight-club-authorizer-${environment}`,
    })

    // Lambda integration
    const integration = new apigateway.LambdaIntegration(this.apiFunction)

    // API Routes
    const apiRoot = this.api.root.addResource('api')
    const v1 = apiRoot.addResource('v1')

    // Users endpoints
    const users = v1.addResource('users')
    users.addMethod('GET', integration, { authorizer }) // Get user profile
    users.addMethod('PUT', integration, { authorizer }) // Update user profile

    const userById = users.addResource('{userId}')
    userById.addMethod('GET', integration, { authorizer }) // Get specific user

    // Weekly stats endpoint
    const weeklyStats = userById.addResource('weekly-stats')
    weeklyStats.addMethod('GET', integration, { authorizer }) // Get user's weekly stats

    // Activities endpoints
    const activities = v1.addResource('activities')
    activities.addMethod('GET', integration, { authorizer }) // Get activities
    activities.addMethod('POST', integration, { authorizer }) // Create activity

    const activityById = activities.addResource('{activityId}')
    activityById.addMethod('GET', integration, { authorizer }) // Get specific activity
    activityById.addMethod('DELETE', integration, { authorizer }) // Delete activity

    // Challenges endpoints
    const challenges = v1.addResource('challenges')
    challenges.addMethod('GET', integration) // Public - get challenges
    challenges.addMethod('POST', integration, { authorizer }) // Create challenge

    const challengeById = challenges.addResource('{challengeId}')
    challengeById.addMethod('GET', integration) // Public - get specific challenge
    challengeById.addMethod('PUT', integration, { authorizer }) // Update challenge
    challengeById.addMethod('DELETE', integration, { authorizer }) // Delete challenge

    // Leaderboard endpoints (public)
    const leaderboard = v1.addResource('leaderboard')
    leaderboard.addMethod('GET', integration) // Get leaderboard

    // Strava webhook endpoint
    const webhook = v1.addResource('webhook')
    const stravaWebhook = webhook.addResource('strava')
    stravaWebhook.addMethod('GET', integration) // Webhook verification
    stravaWebhook.addMethod('POST', integration) // Webhook events

    // Health check endpoint
    const health = v1.addResource('health')
    health.addMethod('GET', integration)

    // Auth endpoints
    const auth = v1.addResource('auth')

    // Strava OAuth endpoints
    const stravaAuth = auth.addResource('strava')
    stravaAuth.addMethod('GET', integration) // Initiate OAuth flow

    // Google OAuth endpoints
    const googleAuth = auth.addResource('google')
    const googleCallback = googleAuth.addResource('callback')
    googleCallback.addMethod('GET', integration) // Handle Google OAuth callback

    // User session endpoint
    const user = auth.addResource('user')
    user.addMethod('GET', integration) // Get current user from cookie

    // Logout endpoint
    const logout = auth.addResource('logout')
    logout.addMethod('POST', integration) // Clear auth cookies

    // Map custom domain to API
    new apigateway.BasePathMapping(this, 'ApiDomainMapping', {
      domainName: customDomain,
      restApi: this.api,
      stage: this.api.deploymentStage,
    })

    // Create Route53 A record for API domain
    new route53.ARecord(this, 'ApiARecord', {
      zone: hostedZone,
      recordName: apiDomainName,
      target: route53.RecordTarget.fromAlias(new route53targets.ApiGatewayDomain(customDomain)),
      comment: `A record for ${apiDomainName} pointing to API Gateway`,
    })

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    })

    new cdk.CfnOutput(this, 'ApiCustomDomainUrl', {
      value: `https://${apiDomainName}`,
      description: 'API custom domain URL',
    })

    new cdk.CfnOutput(this, 'ApiFunctionName', {
      value: this.apiFunction.functionName,
      description: 'API Lambda function name',
    })

    new cdk.CfnOutput(this, 'StravaClientIdSecretArn', {
      value: stravaClientIdSecret.secretArn,
      description: 'ARN of the Strava Client ID secret',
    })

    new cdk.CfnOutput(this, 'StravaClientSecretSecretArn', {
      value: stravaClientSecretSecret.secretArn,
      description: 'ARN of the Strava Client Secret secret',
    })

    new cdk.CfnOutput(this, 'StravaWebhookVerifyToken', {
      value: this.webhookVerifyToken,
      description: 'Webhook verification token for Strava subscriptions',
    })
  }
}

import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'
import * as path from 'path'
import { getConfig } from './config'

export interface ApiStackProps {
  environment: 'dev' | 'prod'
  usersTable: dynamodb.Table
  activitiesTable: dynamodb.Table
  challengesTable: dynamodb.Table
  userPool: cognito.UserPool
}

export class ApiStack extends Construct {
  public readonly api: apigateway.RestApi
  public readonly apiFunction: lambda.Function

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id)

    const { environment, usersTable, activitiesTable, challengesTable, userPool } = props
    const config = getConfig(environment)

    // Create Lambda function for API
    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: `fitnessfight-club-api-${environment}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/api')),
      environment: {
        ENVIRONMENT: environment,
        USERS_TABLE: usersTable.tableName,
        ACTIVITIES_TABLE: activitiesTable.tableName,
        CHALLENGES_TABLE: challengesTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
        REGION: cdk.Stack.of(this).region,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    })

    // Grant Lambda permissions to access DynamoDB tables
    usersTable.grantReadWriteData(this.apiFunction)
    activitiesTable.grantReadWriteData(this.apiFunction)
    challengesTable.grantReadWriteData(this.apiFunction)

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
  }
}

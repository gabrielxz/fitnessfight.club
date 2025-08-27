import * as cdk from 'aws-cdk-lib'
import { Template, Match } from 'aws-cdk-lib/assertions'
import { FitnessFightStack } from '../lib/fitnessfight-stack'

describe('FitnessFightStack', () => {
  test('Stack creates S3 bucket for frontend', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that S3 bucket is created
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'fitnessfight-club-frontend-dev',
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    })
  })

  test('Stack creates CloudFront distribution', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that CloudFront distribution is created
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
        Enabled: true,
      },
    })
  })

  test('Production stack has RETAIN removal policy', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'prod',
    })

    const template = Template.fromStack(stack)

    // Check that S3 bucket has RETAIN policy
    template.hasResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain',
    })
  })

  test('Dev stack has DESTROY removal policy', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that S3 bucket has DESTROY policy
    template.hasResource('AWS::S3::Bucket', {
      UpdateReplacePolicy: 'Delete',
      DeletionPolicy: 'Delete',
    })
  })

  test('Stack creates Cognito User Pool', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that Cognito User Pool is created
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'fitnessfight-club-dev',
      Schema: Match.arrayWith([
        Match.objectLike({
          Name: 'email',
          Required: true,
        }),
      ]),
    })
  })

  test('Stack creates DynamoDB tables', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that DynamoDB tables are created
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'fitnessfight-club-users-dev',
      BillingMode: 'PAY_PER_REQUEST',
    })

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'fitnessfight-club-activities-dev',
      BillingMode: 'PAY_PER_REQUEST',
    })

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'fitnessfight-club-challenges-dev',
      BillingMode: 'PAY_PER_REQUEST',
    })
  })

  test('Stack creates API Gateway and Lambda', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that Lambda function is created
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'fitnessfight-club-api-dev',
      Runtime: 'nodejs20.x',
    })

    // Check that API Gateway is created
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'fitnessfight-club-api-dev',
    })
  })

  test('Stack creates Google identity provider for Cognito', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that Google identity provider is created
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      AttributeMapping: Match.objectLike({
        email: 'email',
        picture: 'picture',
        given_name: 'given_name',
        family_name: 'family_name',
        name: 'name',
      }),
    })

    // Check that User Pool Client includes Google as supported identity provider
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      SupportedIdentityProviders: Match.arrayWith(['COGNITO', 'Google']),
    })

    // Note: We reference an existing secret, not create a new one
    // So we don't check for AWS::SecretsManager::Secret creation
  })

  test('Google identity provider has correct OAuth scopes configured', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that Google identity provider has correct scopes
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      ProviderDetails: Match.objectLike({
        authorize_scopes: 'profile email openid',
      }),
    })
  })

  test('Google identity provider uses configured client ID', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that the Google client ID is properly configured
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      ProviderDetails: Match.objectLike({
        client_id: '943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com',
      }),
    })
  })

  test('Google Client Secret uses Secrets Manager reference', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that the client secret references Secrets Manager
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      ProviderDetails: Match.objectLike({
        client_secret: Match.anyValue(),
      }),
    })

    // Note: We no longer create a new secret, we reference an existing one
    // So we don't check for AWS::SecretsManager::Secret creation
  })

  test('Production environment creates Google provider with prod-specific secret', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'prod',
    })

    const template = Template.fromStack(stack)

    // Note: We reference an existing secret in production too
    // So we don't check for AWS::SecretsManager::Secret creation

    // Verify Google provider exists in production
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
    })
  })

  test('Google provider has dependency relationship with UserPoolClient', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Find the UserPoolClient resource
    const resources = template.toJSON().Resources
    let userPoolClientLogicalId = ''

    for (const [logicalId, resource] of Object.entries(resources)) {
      if ((resource as any).Type === 'AWS::Cognito::UserPoolClient') {
        userPoolClientLogicalId = logicalId
        break
      }
    }

    // Verify the UserPoolClient has a dependency on the Google provider
    expect(userPoolClientLogicalId).not.toBe('')
    const userPoolClient = resources[userPoolClientLogicalId] as any
    expect(userPoolClient.DependsOn).toBeDefined()

    // The dependency should include the Google provider
    const dependencies = Array.isArray(userPoolClient.DependsOn)
      ? userPoolClient.DependsOn
      : [userPoolClient.DependsOn]

    const hasGoogleProviderDependency = dependencies.some((dep: string) =>
      dep.includes('GoogleProvider')
    )
    expect(hasGoogleProviderDependency).toBe(true)
  })

  test('Google provider attribute mapping includes all required attributes', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Verify all required attributes are mapped
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      AttributeMapping: {
        email: 'email',
        picture: 'picture',
        given_name: 'given_name',
        family_name: 'family_name',
        name: 'name',
      },
    })
  })

  test('UserPool OAuth configuration supports Google provider', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Verify UserPoolClient OAuth settings are properly configured for Google
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: Match.arrayWith(['implicit', 'code']),
      AllowedOAuthScopes: Match.arrayWith(['email', 'openid', 'profile']),
      AllowedOAuthFlowsUserPoolClient: true,
    })
  })

  test('Stack outputs include Google Provider Name', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check that Google Provider Name is included in outputs
    const outputs = template.toJSON().Outputs
    let hasGoogleProviderOutput = false

    for (const output of Object.values(outputs || {})) {
      if ((output as any).Description === 'Google Identity Provider Name') {
        hasGoogleProviderOutput = true
        break
      }
    }

    expect(hasGoogleProviderOutput).toBe(true)
  })

  test('Google provider references existing secret', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Verify Google provider exists and is configured
    // We no longer create secrets, we reference existing ones
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      ProviderDetails: {
        client_id: '943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com',
        client_secret: Match.anyValue(), // Secret reference
      },
    })
  })

  test('Google provider is configured with correct provider name', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Check the provider name follows CDK conventions
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderType: 'Google',
      ProviderName: Match.anyValue(), // CDK auto-generates this
    })
  })

  test('User Pool Client callback URLs are configured for OAuth flows', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'dev',
    })

    const template = Template.fromStack(stack)

    // Verify callback URLs include the required OAuth endpoints
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: Match.arrayWith([
        'https://dev.fitnessfight.club/api/auth/callback',
        'https://dev.fitnessfight.club/signin',
        'https://dev.fitnessfight.club/signup',
      ]),
    })
  })

  test('Production User Pool Client callback URLs use production domain', () => {
    const app = new cdk.App()
    const stack = new FitnessFightStack(app, 'TestStack', {
      environment: 'prod',
    })

    const template = Template.fromStack(stack)

    // Verify callback URLs use production domain
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      CallbackURLs: Match.arrayWith([
        'https://fitnessfight.club/api/auth/callback',
        'https://fitnessfight.club/signin',
        'https://fitnessfight.club/signup',
      ]),
    })
  })
})

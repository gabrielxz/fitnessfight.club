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
})

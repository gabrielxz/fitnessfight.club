import * as cdk from 'aws-cdk-lib'
import { Template } from 'aws-cdk-lib/assertions'
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
})

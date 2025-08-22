import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as route53targets from 'aws-cdk-lib/aws-route53-targets'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import { Construct } from 'constructs'
import * as path from 'path'
import { AuthStack } from './auth-stack'
import { DatabaseStack } from './database-stack'
import { ApiStack } from './api-stack'
import { getConfig } from './config'

export interface FitnessFightStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod'
}

export class FitnessFightStack extends cdk.Stack {
  public readonly frontendBucket: s3.Bucket
  public readonly distribution: cloudfront.Distribution

  constructor(scope: Construct, id: string, props: FitnessFightStackProps) {
    super(scope, id, props)

    const { environment } = props
    const isProd = environment === 'prod'
    const config = getConfig(environment)

    // S3 bucket for frontend hosting
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `fitnessfight-club-frontend-${environment}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      versioned: isProd,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: isProd
        ? [
            {
              id: 'delete-old-versions',
              noncurrentVersionExpiration: cdk.Duration.days(30),
              enabled: true,
            },
          ]
        : [],
    })

    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${environment} frontend bucket`,
    })

    // Grant CloudFront access to the bucket
    this.frontendBucket.grantRead(originAccessIdentity)

    // Import the hosted zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: config.domainName,
    })

    // Import the certificate from cross-stack reference
    const certificateArn = cdk.Fn.importValue(`fitnessfight-club-${environment}-certificate-arn`)
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn)

    // Determine domain names
    const domainNames =
      environment === 'dev'
        ? [`dev.${config.domainName}`]
        : [config.domainName, `www.${config.domainName}`]

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      domainNames,
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],
      priceClass: isProd
        ? cloudfront.PriceClass.PRICE_CLASS_100
        : cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      comment: `CloudFront distribution for fitnessfight.club ${environment}`,
    })

    // Deploy frontend files to S3
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/out'))],
      destinationBucket: this.frontendBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      memoryLimit: 256,
      prune: true,
      retainOnDelete: false,
    })

    // Create Route53 A records for the domain(s)
    domainNames.forEach((domainName, index) => {
      new route53.ARecord(this, `ARecord${index}`, {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(this.distribution)
        ),
        comment: `A record for ${domainName} pointing to CloudFront distribution`,
      })
    })

    // Outputs
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'Name of the S3 bucket hosting the frontend',
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront distribution ID',
    })

    new cdk.CfnOutput(this, 'CloudFrontDistributionDomain', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    })

    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront URL for accessing the frontend',
    })

    new cdk.CfnOutput(this, 'CustomDomainURL', {
      value: `https://${domainNames[0]}`,
      description: 'Custom domain URL for accessing the frontend',
    })

    // Add stack-level tags (these will be applied to all resources)
    cdk.Tags.of(this).add('Stack', this.stackName)
    cdk.Tags.of(this).add('ManagedBy', 'CDK')

    // Create Auth stack (Cognito)
    const authStack = new AuthStack(this, 'Auth', {
      environment,
    })

    // Create Database stack (DynamoDB)
    const databaseStack = new DatabaseStack(this, 'Database', {
      environment,
    })

    // Create API stack (Lambda + API Gateway)
    const apiStack = new ApiStack(this, 'Api', {
      environment,
      usersTable: databaseStack.usersTable,
      activitiesTable: databaseStack.activitiesTable,
      challengesTable: databaseStack.challengesTable,
      userPool: authStack.userPool,
    })

    // Output API URL
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: apiStack.api.url,
      description: 'API Gateway endpoint URL',
    })

    // Output Cognito details for frontend configuration
    new cdk.CfnOutput(this, 'CognitoUserPoolId', {
      value: authStack.userPool.userPoolId,
      description: 'Cognito User Pool ID for frontend config',
    })

    new cdk.CfnOutput(this, 'CognitoClientId', {
      value: authStack.userPoolClient.userPoolClientId,
      description: 'Cognito Client ID for frontend config',
    })

    // Output webhook verify token for webhook subscription script
    new cdk.CfnOutput(this, 'StravaWebhookVerifyToken', {
      value: apiStack.webhookVerifyToken,
      description: 'Webhook verification token for Strava subscriptions',
    })
  }
}

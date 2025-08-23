import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

export interface AuthStackProps {
  environment: 'dev' | 'prod'
}

export class AuthStack extends Construct {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly userPoolDomain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id)

    const { environment } = props

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `fitnessfight-club-${environment}`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        stravaId: new cognito.StringAttribute({
          mutable: true,
        }),
        clubMember: new cognito.BooleanAttribute({
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    // Create User Pool Client
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `fitnessfight-club-web-${environment}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls:
          environment === 'prod'
            ? [
                'https://fitnessfight.club/api/auth/callback',
                'https://fitnessfight.club/signin',
                'https://fitnessfight.club/signup',
                'http://localhost:3000/api/auth/callback',
                'http://localhost:3000/signin',
                'http://localhost:3000/signup',
              ]
            : [
                'https://dev.fitnessfight.club/api/auth/callback',
                'https://dev.fitnessfight.club/signin',
                'https://dev.fitnessfight.club/signup',
                'http://localhost:3000/api/auth/callback',
                'http://localhost:3000/signin',
                'http://localhost:3000/signup',
              ],
        logoutUrls:
          environment === 'prod'
            ? ['https://fitnessfight.club/', 'http://localhost:3000/']
            : ['https://dev.fitnessfight.club/', 'http://localhost:3000/'],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    })

    // Create Hosted UI Domain
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: `fitnessfight-club-${environment}`,
      },
    })

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    })

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    })

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `https://${this.userPoolDomain.domainName}.auth.${cdk.Stack.of(this).region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Domain',
    })
  }
}

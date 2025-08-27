import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cr from 'aws-cdk-lib/custom-resources'
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
        givenName: {
          required: false,
          mutable: true,
        },
        familyName: {
          required: false,
          mutable: true,
        },
        fullname: {
          required: false,
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
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    })

    // Google OAuth Provider Configuration
    // Reference existing secret - must be created manually before first deployment
    // aws secretsmanager create-secret --name fitnessfight-club-google-client-secret-dev --secret-string "YOUR_SECRET" --region us-east-1
    const googleClientSecretSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleClientSecret',
      `fitnessfight-club-google-client-secret-${environment}`
    )

    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: '943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com',
      clientSecretValue: googleClientSecretSecret.secretValue,
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
      scopes: ['profile', 'email', 'openid'],
    })

    this.userPoolClient.node.addDependency(googleProvider)

    // Custom resource to sync the actual Google secret value to Cognito
    // This is needed because Cognito doesn't support CloudFormation secret references
    const googleSecretSync = new cr.AwsCustomResource(this, 'GoogleSecretSync', {
      onCreate: {
        service: 'SecretsManager',
        action: 'getSecretValue',
        parameters: {
          SecretId: `fitnessfight-club-google-client-secret-${environment}`,
        },
        physicalResourceId: cr.PhysicalResourceId.of('GoogleSecretSync'),
      },
      onUpdate: {
        service: 'SecretsManager',
        action: 'getSecretValue',
        parameters: {
          SecretId: `fitnessfight-club-google-client-secret-${environment}`,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['secretsmanager:GetSecretValue'],
          resources: [googleClientSecretSecret.secretArn],
        }),
        new iam.PolicyStatement({
          actions: ['cognito-idp:UpdateIdentityProvider'],
          resources: [this.userPool.userPoolArn],
        }),
      ]),
    })

    // After getting the secret, update Cognito
    const updateCognito = new cr.AwsCustomResource(this, 'UpdateCognitoGoogleProvider', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateIdentityProvider',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          ProviderName: 'Google',
          ProviderDetails: {
            client_id: '943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com',
            client_secret: googleSecretSync.getResponseField('SecretString'),
            authorize_scopes: 'profile email openid',
          },
          AttributeMapping: {
            email: 'email',
            given_name: 'given_name',
            family_name: 'family_name',
            name: 'name',
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of('UpdateCognitoGoogleProvider'),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateIdentityProvider',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          ProviderName: 'Google',
          ProviderDetails: {
            client_id: '943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com',
            client_secret: googleSecretSync.getResponseField('SecretString'),
            authorize_scopes: 'profile email openid',
          },
          AttributeMapping: {
            email: 'email',
            given_name: 'given_name',
            family_name: 'family_name',
            name: 'name',
          },
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['cognito-idp:UpdateIdentityProvider'],
          resources: [this.userPool.userPoolArn],
        }),
      ]),
    })

    // Ensure updates happen in correct order
    updateCognito.node.addDependency(googleProvider)
    updateCognito.node.addDependency(googleSecretSync)

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

    new cdk.CfnOutput(this, 'GoogleProviderName', {
      value: googleProvider.providerName,
      description: 'Google Identity Provider Name',
    })
  }
}

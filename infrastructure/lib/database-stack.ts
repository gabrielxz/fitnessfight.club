import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export interface DatabaseStackProps {
  environment: 'dev' | 'prod'
}

export class DatabaseStack extends Construct {
  public readonly usersTable: dynamodb.Table
  public readonly activitiesTable: dynamodb.Table
  public readonly challengesTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id)

    const { environment } = props
    const isProd = environment === 'prod'

    // Users table - stores user profiles and Strava integration
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `fitnessfight-club-users-${environment}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    })

    // Add GSI for Strava ID lookups
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'stravaId-index',
      partitionKey: {
        name: 'stravaId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Activities table - stores fitness activities from Strava
    this.activitiesTable = new dynamodb.Table(this, 'ActivitiesTable', {
      tableName: `fitnessfight-club-activities-${environment}`,
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'activityId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    })

    // Add GSI for date range queries
    this.activitiesTable.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Add GSI for club-wide leaderboards
    this.activitiesTable.addGlobalSecondaryIndex({
      indexName: 'clubId-timestamp-index',
      partitionKey: {
        name: 'clubId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Challenges table - stores fitness challenges and competitions
    this.challengesTable = new dynamodb.Table(this, 'ChallengesTable', {
      tableName: `fitnessfight-club-challenges-${environment}`,
      partitionKey: {
        name: 'challengeId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: isProd },
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    })

    // Add GSI for active challenges
    this.challengesTable.addGlobalSecondaryIndex({
      indexName: 'status-endDate-index',
      partitionKey: {
        name: 'status',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'endDate',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB Users table name',
    })

    new cdk.CfnOutput(this, 'ActivitiesTableName', {
      value: this.activitiesTable.tableName,
      description: 'DynamoDB Activities table name',
    })

    new cdk.CfnOutput(this, 'ChallengesTableName', {
      value: this.challengesTable.tableName,
      description: 'DynamoDB Challenges table name',
    })
  }
}

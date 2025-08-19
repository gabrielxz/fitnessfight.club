export interface EnvironmentConfig {
  environment: 'dev' | 'prod'
  domainName?: string
  certificateArn?: string
  hostedZoneId?: string
  dynamoDbBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  removalPolicy: 'DESTROY' | 'RETAIN'
}

export const getConfig = (environment: 'dev' | 'prod'): EnvironmentConfig => {
  const configs: Record<'dev' | 'prod', EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      removalPolicy: 'DESTROY',
      // Domain configuration will be added when Route53 is set up
    },
    prod: {
      environment: 'prod',
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      removalPolicy: 'RETAIN',
      // Domain configuration will be added when Route53 is set up
      // domainName: 'fitnessfight.club',
      // certificateArn: 'arn:aws:acm:us-east-1:...',
      // hostedZoneId: 'Z...',
    },
  }

  return configs[environment]
}

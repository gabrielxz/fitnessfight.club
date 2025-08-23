export interface EnvironmentConfig {
  environment: 'dev' | 'prod'
  domainName: string
  certificateArn?: string
  hostedZoneId: string
  dynamoDbBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED'
  removalPolicy: 'DESTROY' | 'RETAIN'
}

export const getConfig = (environment: 'dev' | 'prod'): EnvironmentConfig => {
  const hostedZoneId = 'Z06109431OYB2L4NNQW58'

  const configs: Record<'dev' | 'prod', EnvironmentConfig> = {
    dev: {
      environment: 'dev',
      domainName: 'fitnessfight.club',
      hostedZoneId,
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      removalPolicy: 'DESTROY',
    },
    prod: {
      environment: 'prod',
      domainName: 'fitnessfight.club',
      hostedZoneId,
      dynamoDbBillingMode: 'PAY_PER_REQUEST',
      removalPolicy: 'RETAIN',
    },
  }

  return configs[environment]
}

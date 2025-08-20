import * as cdk from 'aws-cdk-lib'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

export interface CertificateStackProps extends cdk.StackProps {
  environment: 'dev' | 'prod'
  hostedZoneId: string
  domainName: string
}

export class CertificateStack extends cdk.Stack {
  public readonly certificate: acm.Certificate

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props)

    const { environment, hostedZoneId, domainName } = props

    // Import the hosted zone
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId.replace('/hostedzone/', ''),
      zoneName: 'fitnessfight.club',
    })

    // Determine domain names based on environment
    const primaryDomain = environment === 'dev' ? `dev.${domainName}` : domainName
    const alternativeDomains =
      environment === 'prod'
        ? [`www.${domainName}`, `api.${domainName}`]
        : [`api.dev.${domainName}`]

    // Create certificate with DNS validation
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: primaryDomain,
      subjectAlternativeNames: alternativeDomains,
      validation: acm.CertificateValidation.fromDns(hostedZone),
      certificateName: `fitnessfight-club-${environment}-certificate`,
    })

    // Add tags
    cdk.Tags.of(this.certificate).add('Project', 'fitnessfight.club')
    cdk.Tags.of(this.certificate).add('Environment', environment)

    // Output the certificate ARN
    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: `ACM Certificate ARN for ${environment} environment`,
      exportName: `fitnessfight-club-${environment}-certificate-arn`,
    })
  }
}

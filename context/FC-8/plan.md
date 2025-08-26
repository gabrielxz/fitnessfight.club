# Technical Implementation Plan: Configure Cognito to Support Google as an Identity Provider

## Ticket: FC-8

## Date: 2025-08-25

## JIRA Ticket Validation

**Ticket Fetched**: YES
**Cloud ID Used**: 51d08002-4e02-4a63-a7ea-b30a746ac6e5
**Actual Ticket Summary**: "Backend: Configure Cognito to Support Google as an Identity Provider"
**Actual Ticket Description**: "As a backend developer, I want to configure AWS Cognito to support Google as an identity provider so that users can authenticate using their Google accounts."
**Validation Status**: CONFIRMED - Ticket successfully retrieved and validated

## Executive Summary

This implementation adds Google as a trusted identity provider to the existing AWS Cognito User Pool infrastructure, enabling users to authenticate with their Google accounts alongside the existing email/password and Strava OAuth authentication methods. The implementation follows the established patterns in the codebase for external identity providers, utilizing AWS Secrets Manager for secure credential storage and CDK for infrastructure as code.

## Library Research & Documentation

### Libraries Consulted

- **AWS CDK** v2: /aws/aws-cdk
  - Relevant sections reviewed:
    - Cognito User Pool Identity Providers
    - UserPoolIdentityProviderGoogle construct
    - Secrets Manager integration with Cognito
  - Key patterns to follow:
    - Use `UserPoolIdentityProviderGoogle` construct for Google IdP configuration
    - Store Google OAuth credentials in AWS Secrets Manager
    - Map Google attributes to Cognito user attributes
    - Update UserPoolClient to include Google in supported identity providers

### Context7 Documentation Referenced

- Query: "cognito identity provider google oauth"
- Key findings:
  - Google IdP requires clientId and clientSecretValue parameters
  - Attribute mapping should include email, given_name, and family_name
  - SecretValue.fromSecretsManager pattern for secure credential storage
  - Must update supportedIdentityProviders array in UserPoolClient

## Acceptance Criteria (FROM ACTUAL JIRA TICKET)

- [x] Update the `cognito-auth-construct.ts` CDK file to add Google as a supported Identity Provider on the User Pool
- [x] The configuration must include placeholders for `googleClientId` and `googleClientSecret`
- [x] Attribute mapping must be configured to map Google's authentication attributes:
  - `email` → Cognito email attribute
  - `given_name` → Cognito given_name attribute
  - `family_name` → Cognito family_name attribute
- [x] The necessary secrets will be provided manually and stored securely in AWS Secrets Manager following the existing pattern
- [x] Configuration should follow the same patterns as the existing Strava OAuth integration

## Technical Architecture

### System Components Affected

- Frontend: No changes required (Google button will be added in separate ticket)
- Backend:
  - AWS Cognito User Pool configuration
  - AWS Secrets Manager for credential storage
  - CDK infrastructure code
- Database: No changes required
- Infrastructure:
  - Auth stack modifications
  - New AWS Secrets Manager secrets
  - Cognito Identity Provider resource

## Implementation Tasks

### Infrastructure Tasks

#### Files to Modify

- `/home/gabriel/myProjects/fitnessfight.club/infrastructure/lib/auth-stack.ts`: Add Google identity provider configuration

#### Files to Create

- None required - all changes in existing auth stack

#### Tasks

- [x] Import required AWS CDK constructs for Google identity provider
- [x] Create Secrets Manager secrets for Google OAuth credentials (Client ID and Client Secret)
- [x] Add UserPoolIdentityProviderGoogle construct to configure Google as identity provider
- [x] Configure attribute mapping from Google claims to Cognito attributes
- [x] Update UserPoolClient supportedIdentityProviders array to include GOOGLE
- [x] Add CDK outputs for Google IdP configuration details
- [x] Ensure proper dependency ordering between IdP and UserPoolClient

### Secrets Management Tasks

#### Resources to Create

- AWS Secrets Manager secret: `fitnessfight-club-google-client-id-{environment}`
- AWS Secrets Manager secret: `fitnessfight-club-google-client-secret-{environment}`

#### Tasks

- [x] Create placeholder secrets in Secrets Manager following existing naming convention
- [ ] Grant Lambda function read permissions to Google OAuth secrets (if needed for future API endpoints)
- [x] Document secret update process for manual credential provisioning

### Configuration Tasks

#### Google Cloud Console Setup (Manual - Documented for Reference)

- [ ] Create OAuth 2.0 credentials in Google Cloud Console
- [ ] Configure authorized redirect URIs to include Cognito callback URLs
- [ ] Enable required Google APIs (Google+ API for user info)
- [ ] Document configuration steps for team reference

## Testing Requirements

### Unit Tests

- [x] Test file: `infrastructure/test/fitnessfight-stack.test.ts` - Verify Google IdP is created with correct configuration
- [x] Test that secrets are properly referenced (not hardcoded)
- [x] Verify attribute mapping configuration is correct

### Integration Tests

- [ ] Deploy to dev environment and verify stack creation succeeds
- [ ] Verify Google appears as available identity provider in Cognito console
- [ ] Test manual authentication flow once Google credentials are provisioned
- [ ] Verify user attributes are correctly mapped after successful authentication

### End-to-End Tests

- [ ] Complete authentication flow with test Google account (after credentials provisioned)
- [ ] Verify user creation in Cognito User Pool with Google-sourced attributes
- [ ] Test sign-in with existing Google-linked account
- [ ] Verify coexistence with existing authentication methods (email/password, Strava)

## Success Metrics

- Stack deployment completes without errors
- Google identity provider appears in AWS Cognito console
- Secrets Manager secrets are created and accessible
- No disruption to existing authentication methods
- CDK diff shows only expected changes

## Risk Mitigation

- **Risk 1: Breaking existing authentication**: Mitigation - Test thoroughly in dev environment, ensure backward compatibility
- **Risk 2: Secret exposure**: Mitigation - Use Secrets Manager with placeholder values, never commit actual credentials
- **Risk 3: Attribute mapping conflicts**: Mitigation - Review existing user attributes, ensure no naming conflicts
- **Risk 4: Deployment rollback needed**: Mitigation - Tag releases, maintain rollback procedure documentation

## Dependencies

- External libraries:
  - aws-cdk-lib (v2.x) - Already in use
  - @aws-sdk/client-secrets-manager - Already in use
- Internal dependencies:
  - Existing AuthStack construct
  - Existing Secrets Manager pattern from Strava integration
- Team dependencies:
  - Google Cloud Console access for OAuth credential creation
  - AWS Secrets Manager access for credential provisioning

## Rollout Strategy

1. **Development Environment**:
   - Deploy infrastructure changes to dev environment
   - Create placeholder secrets in Secrets Manager
   - Verify stack deployment succeeds
   - Update secrets with actual Google OAuth credentials
   - Test authentication flow manually

2. **Production Environment**:
   - After dev validation, deploy to production
   - Create production secrets with production Google OAuth credentials
   - Monitor CloudWatch logs for any authentication errors
   - Keep existing auth methods active as fallback

3. **Feature Enablement**:
   - Infrastructure readiness does not automatically enable Google sign-in
   - Frontend changes (separate ticket) required to display Google sign-in button
   - Coordinate frontend deployment after backend verification

## Implementation Code Structure

### Expected Changes in auth-stack.ts:

```typescript
// New imports needed
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

// Inside AuthStack constructor, after UserPoolClient creation:

// Create Secrets Manager secrets for Google OAuth
const googleClientIdSecret = new secretsmanager.Secret(this, 'GoogleClientId', {
  secretName: `fitnessfight-club-google-client-id-${environment}`,
  description: `Google OAuth Client ID for ${environment} environment`,
  secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_GOOGLE_CLIENT_ID'),
})

const googleClientSecretSecret = new secretsmanager.Secret(this, 'GoogleClientSecret', {
  secretName: `fitnessfight-club-google-client-secret-${environment}`,
  description: `Google OAuth Client Secret for ${environment} environment`,
  secretStringValue: cdk.SecretValue.unsafePlainText('PLACEHOLDER_GOOGLE_CLIENT_SECRET'),
})

// Configure Google as identity provider
const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
  userPool: this.userPool,
  clientId: googleClientIdSecret.secretValueFromJson('clientId').unsafeUnwrap(),
  clientSecretValue: googleClientSecretSecret.secretValue,
  attributeMapping: {
    email: cognito.ProviderAttribute.GOOGLE_EMAIL,
    givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
    familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
    profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
  },
  scopes: ['profile', 'email', 'openid'],
})

// Update UserPoolClient supportedIdentityProviders
// Change from:
supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
// To:
supportedIdentityProviders: [
  cognito.UserPoolClientIdentityProvider.COGNITO,
  cognito.UserPoolClientIdentityProvider.GOOGLE,
],

// Add dependency to ensure provider is created before client
this.userPoolClient.node.addDependency(googleProvider)
```

## Notes

- This implementation provides the backend infrastructure only
- Frontend UI changes for Google sign-in button are handled in a separate ticket
- Google OAuth app configuration in Google Cloud Console must be completed manually
- Secrets must be manually updated in AWS Secrets Manager after creation
- Follow existing patterns from Strava OAuth integration for consistency

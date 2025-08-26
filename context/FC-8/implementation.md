# Implementation Log: Configure Cognito to Support Google as an Identity Provider

## Ticket: FC-8

## Date: 2025-08-25

## Initial Implementation

### Overview

Implementing Google OAuth as an identity provider for AWS Cognito User Pool following the existing patterns established for Strava OAuth integration.

### Files Modified

1. `/home/gabriel/myProjects/fitnessfight.club/infrastructure/lib/auth-stack.ts`
   - Added AWS Secrets Manager import
   - Created Google OAuth client secrets following Strava pattern
   - Added UserPoolIdentityProviderGoogle construct
   - Configured attribute mapping from Google to Cognito
   - Updated UserPoolClient supportedIdentityProviders to include GOOGLE
   - Added proper dependency ordering
   - Added CDK outputs for Google provider configuration

### Implementation Details

#### Google OAuth Secrets Configuration

- Created two AWS Secrets Manager secrets:
  - `fitnessfight-club-google-client-id-{environment}` - Stores Google OAuth Client ID
  - `fitnessfight-club-google-client-secret-{environment}` - Stores Google OAuth Client Secret
- Used placeholder values that will be manually updated after deployment
- Followed exact pattern used for Strava OAuth credentials in api-stack.ts

#### Google Identity Provider Setup

- Configured UserPoolIdentityProviderGoogle with:
  - Client ID from Secrets Manager
  - Client Secret from Secrets Manager
  - Attribute mapping for email, given_name, family_name, and profile picture
  - OAuth scopes: profile, email, openid

#### UserPoolClient Updates

- Modified supportedIdentityProviders array to include GOOGLE alongside COGNITO
- Ensured proper dependency ordering so Google IdP is created before UserPoolClient

#### CDK Output

- Added Google Provider Name output for reference and debugging

### Changes Made

- Lines 2: Added secretsmanager import
- Lines 103-139: Added Google OAuth configuration block after UserPoolClient creation
- Line 97: Updated supportedIdentityProviders array to include GOOGLE
- Lines 141-150: Added dependency and CDK output

### Verification Steps Completed

1. ✅ Ran `npm run build` in infrastructure directory - TypeScript compilation successful
2. ✅ Ran `npm run synth -- --context environment=dev` - CDK stack synthesized successfully
3. ✅ Ran `npx cdk diff --context environment=dev` - Changes reviewed and confirmed:
   - New Secrets Manager secret for Google Client Secret
   - New Google Identity Provider resource
   - UserPoolClient updated with Google in supportedIdentityProviders
   - Proper dependency ordering added
4. ✅ Ran `npm test` - All 8 tests pass, including new test for Google IdP
5. ⏳ Ready for deployment with `npm run deploy:dev`
6. ⏳ Secrets need to be manually updated in AWS Secrets Manager post-deployment
7. ⏳ Google IdP availability will be verified in AWS Cognito console after deployment

### Notes

- Implementation follows established patterns from Strava OAuth integration
- Secrets use placeholder values and must be manually updated post-deployment
- Google Client ID is hardcoded as placeholder in CDK (per AWS CDK requirements for Google IdP)
- Google Client Secret is stored in AWS Secrets Manager
- Both Client ID and Secret must be updated with actual values from Google Cloud Console
- No frontend changes included (separate ticket)
- Google OAuth app configuration in Google Cloud Console required separately

### Post-Deployment Manual Steps Required

1. Obtain Google OAuth 2.0 credentials from Google Cloud Console
2. Update the placeholder Client ID in the CDK code and redeploy
3. Update the Client Secret in AWS Secrets Manager console
4. Configure authorized redirect URIs in Google Cloud Console to include Cognito callback URL
5. Test authentication flow once credentials are in place

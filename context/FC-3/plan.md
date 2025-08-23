# Technical Implementation Plan: AWS Cognito Authentication with Header UI and Strava Integration

## Ticket: FC-3

## Date: 2025-08-23

## Executive Summary

Implement comprehensive AWS Cognito authentication for the Fitness Fight Club application, including email-based sign-up/sign-in, a dynamic header component showing auth state, and proper integration with the existing Strava OAuth flow. This implementation will gate Strava connections behind user authentication and properly link Cognito users with their Strava tokens.

## Library Research & Documentation

### Libraries Consulted

- **AWS Amplify JS** v6.x: [/aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js)
  - Relevant sections reviewed: Auth module, Cognito server/client APIs, JWT verification
  - Key patterns to follow: Server-side auth with Next.js App Router, token management, getCurrentUser pattern
- **AWS Amplify Adapter Next.js**: [/websites/amplify_aws](https://docs.amplify.aws)
  - Relevant sections reviewed: createServerRunner, cookie-based authentication, JWT verification
  - Key patterns to follow: Server Component auth context, API route protection

- **AWS SDK v3**: [@aws-sdk/client-cognito-identity-provider](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/)
  - Relevant sections reviewed: CognitoJwtVerifier, token validation
  - Key patterns to follow: Lambda JWT verification, custom authorizers

### Context7 Documentation Referenced

- Query: "cognito authentication nextjs" - Retrieved patterns for Next.js 14 App Router integration
- Query: "cognito jwt verification lambda" - Retrieved Lambda trigger patterns and JWT verification approaches
- Key findings: Use aws-amplify/adapter-nextjs for SSR compatibility, implement JWT verification in Lambda middleware

## Acceptance Criteria

- [ ] Users can sign up with email/password through a dedicated signup page
- [ ] Users can sign in with email/password through a dedicated signin page
- [ ] Header component displays appropriate UI based on authentication state
- [ ] Strava connection button only appears for authenticated users
- [ ] API endpoints validate Cognito JWT tokens before processing requests
- [ ] DynamoDB users table includes cognitoId field linking Cognito and Strava identities
- [ ] Existing Strava OAuth flow continues to work for authenticated users
- [ ] Session persists across page refreshes using secure cookies
- [ ] Sign out functionality clears session and redirects appropriately

## Technical Architecture

### System Components Affected

- Frontend: Header component, auth pages, homepage, API client
- Backend: Lambda function (JWT validation), API Gateway (authorizer)
- Database: DynamoDB users table (schema update)
- Infrastructure: Cognito User Pool configuration, Lambda environment variables

## Implementation Tasks

### Frontend Tasks

#### Files to Modify

- `frontend/components/header.tsx`: Add auth state display and sign in/out buttons
- `frontend/app/page.tsx`: Conditionally render Strava connection based on auth state
- `frontend/lib/auth.ts`: New file for auth utilities
- `frontend/lib/amplify-config.ts`: New file for Amplify configuration

#### Files to Create

- `frontend/app/signin/page.tsx`: Sign in page with email/password form
- `frontend/app/signup/page.tsx`: Sign up page with registration form
- `frontend/app/api/auth/[...slug]/route.ts`: Auth API routes for Amplify
- `frontend/components/auth-provider.tsx`: Client-side auth context provider
- `frontend/components/auth-forms.tsx`: Reusable auth form components

#### Tasks

- [ ] Install AWS Amplify dependencies: `@aws-amplify/adapter-nextjs`, `aws-amplify`
- [ ] Configure Amplify with Cognito User Pool settings in `amplify-config.ts`
- [ ] Create AuthProvider component using React Context for client-side auth state
- [ ] Implement sign up page with email/password form and validation
- [ ] Implement sign in page with email/password form and error handling
- [ ] Create auth API route handler for Amplify auth operations
- [ ] Update Header component to show user email when signed in
- [ ] Add sign out button to Header that calls Amplify signOut
- [ ] Update homepage to only show Strava connection for authenticated users
- [ ] Implement server-side auth check using `getCurrentUser` from `@aws-amplify/adapter-nextjs`
- [ ] Add loading states for auth operations
- [ ] Implement password reset flow UI components

### Backend Tasks

#### Files to Modify

- `infrastructure/lambda/api/index.js`: Add JWT verification middleware
- `infrastructure/lambda/api/auth.js`: New file for auth utilities
- `infrastructure/lib/api-stack.ts`: Add Cognito authorizer configuration
- `infrastructure/lib/auth-stack.ts`: Update Cognito configuration

#### Tasks

- [ ] Install JWT verification dependencies in Lambda: `aws-jwt-verify`
- [ ] Create JWT verification middleware function in `auth.js`
- [ ] Implement token validation logic checking issuer, audience, and expiry
- [ ] Add cognitoId extraction from JWT claims
- [ ] Update all protected endpoints to use JWT verification middleware
- [ ] Modify Strava OAuth callback to link cognitoId with Strava user
- [ ] Add error handling for invalid/expired tokens
- [ ] Implement token refresh logic if needed
- [ ] Add CloudWatch logging for auth events
- [ ] Configure API Gateway to pass Authorization header to Lambda

### Database Tasks

#### Schema Changes

- Add `cognitoId` field to users table as a secondary index
- Add `authProvider` field to track authentication method (cognito/strava)
- Add `emailVerified` boolean field

#### Tasks

- [ ] Update DynamoDB users table schema in `database-stack.ts`
- [ ] Add Global Secondary Index (GSI) on cognitoId field
- [ ] Create migration script for existing users (set authProvider: 'strava')
- [ ] Update user creation logic to include cognitoId
- [ ] Modify user lookup logic to support both userId and cognitoId queries

### Infrastructure Tasks

#### Resources to Update

- `infrastructure/lib/auth-stack.ts`: Cognito User Pool configuration
- `infrastructure/lib/api-stack.ts`: API Gateway authorizer
- `infrastructure/lib/database-stack.ts`: DynamoDB schema

#### Tasks

- [ ] Update Cognito User Pool to remove stravaId custom attribute (will link via DB)
- [ ] Configure Cognito callback URLs to include auth pages
- [ ] Add Lambda environment variables for Cognito User Pool ID and Client ID
- [ ] Create API Gateway Cognito authorizer
- [ ] Update API Gateway routes to use authorizer for protected endpoints
- [ ] Add Cognito domain outputs to CloudFormation
- [ ] Configure Cognito email templates for verification and password reset
- [ ] Set up Cognito groups for future role-based access control
- [ ] Add CloudWatch alarms for failed authentication attempts

## Testing Requirements

### Unit Tests

- [ ] `frontend/lib/auth.test.ts`: Test auth utility functions
- [ ] `frontend/components/auth-forms.test.tsx`: Test form validation and submission
- [ ] `infrastructure/lambda/api/auth.test.js`: Test JWT verification logic
- [ ] `frontend/components/header.test.tsx`: Test conditional rendering based on auth state

### Integration Tests

- [ ] Test complete sign-up flow including email verification
- [ ] Test sign-in flow with correct and incorrect credentials
- [ ] Test sign-out flow and session cleanup
- [ ] Test protected API endpoints with valid and invalid tokens
- [ ] Test Strava OAuth flow for authenticated users
- [ ] Test token refresh mechanism

### End-to-End Tests

- [ ] User can sign up, verify email, and sign in
- [ ] Authenticated user can connect Strava account
- [ ] Session persists across page refreshes
- [ ] Unauthorized access redirects to sign-in page
- [ ] Sign out clears session and redirects to homepage

## Success Metrics

- **Authentication Success Rate**: > 95% successful sign-ins
- **Session Duration**: Average session > 30 minutes
- **Token Validation Performance**: < 50ms average validation time
- **User Conversion**: 80% of signed-up users complete email verification
- **Strava Connection Rate**: 60% of authenticated users connect Strava

## Risk Mitigation

- **Token Expiry Issues**: Implement automatic token refresh with 5-minute buffer before expiry
- **Email Delivery Failures**: Add retry logic and fallback to manual verification code entry
- **Session Loss**: Implement persistent sessions using secure HTTP-only cookies
- **CORS Issues**: Configure proper CORS headers for all auth endpoints
- **Rate Limiting**: Implement throttling on auth endpoints to prevent brute force attacks
- **Migration Risks**: Create backup of users table before schema changes

## Dependencies

- External libraries:
  - `aws-amplify@^6.0.0` - Core Amplify library
  - `@aws-amplify/adapter-nextjs@^1.0.0` - Next.js SSR adapter
  - `aws-jwt-verify@^4.0.0` - JWT verification for Lambda
- Internal dependencies:
  - Existing Strava OAuth implementation must continue working
  - DynamoDB users table must maintain backward compatibility
- Team dependencies:
  - DevOps team for Cognito production configuration
  - Security review for authentication implementation

## Rollout Strategy

1. **Phase 1 - Development Environment**:
   - Deploy Cognito configuration changes
   - Test with small group of internal users
   - Monitor CloudWatch for errors

2. **Phase 2 - Staged Rollout**:
   - Enable feature flag for 10% of users
   - Monitor authentication metrics
   - Gradually increase to 100% over 1 week

3. **Phase 3 - Production Deployment**:
   - Full deployment with monitoring
   - Keep Strava-only auth as fallback for 2 weeks
   - Remove fallback after stability confirmed

4. **Rollback Plan**:
   - Feature flag to disable Cognito auth
   - Revert to Strava-only authentication
   - Database changes are backward compatible (no rollback needed)

## Implementation Notes

### Amplify Configuration

```typescript
// frontend/lib/amplify-config.ts
import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
      userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
    },
  },
})
```

### JWT Verification Pattern

```javascript
// infrastructure/lambda/api/auth.js
const { CognitoJwtVerifier } = require('aws-jwt-verify')

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: 'access',
  clientId: process.env.USER_POOL_CLIENT_ID,
})

async function verifyToken(token) {
  try {
    const payload = await verifier.verify(token)
    return { valid: true, cognitoId: payload.sub }
  } catch {
    return { valid: false }
  }
}
```

### Database Schema Update

```typescript
// Add to users table item
{
  userId: "strava_123",         // Primary key (Strava ID)
  cognitoId: "cognito_456",     // GSI (Cognito sub)
  authProvider: "cognito",      // "cognito" or "strava"
  email: "user@example.com",    // From Cognito
  emailVerified: true,          // From Cognito
  // ... existing Strava fields
}
```

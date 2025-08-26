# Technical Implementation Plan: Add "Sign in with Google" Button to Login Page

## Ticket: FC-9

## Date: 2025-08-26

## JIRA Ticket Validation

**Ticket Fetched**: YES
**Cloud ID Used**: 51d08002-4e02-4a63-a7ea-b30a746ac6e5
**Actual Ticket Summary**: "Frontend: Add \"Sign in with Google\" Button to Login Page"
**Actual Ticket Description**:

- User wants to sign in using Google account for quick access without creating a new password
- Sign-in page currently only displays email/password fields
- Need Google sign-in button following Google's branding guidelines
- Button should initiate Google OAuth flow when clicked

**Validation Status**: CONFIRMED - Ticket successfully retrieved and requirements validated

## Executive Summary

Implement Google OAuth sign-in functionality on the login page by adding a branded "Sign in with Google" button that leverages the existing AWS Cognito Google Identity Provider configuration to initiate federated authentication. The implementation will follow Google's branding guidelines and integrate with the existing auth-service pattern.

## Library Research & Documentation

### Libraries Consulted

- **@aws-sdk/client-cognito-identity-provider** v3: Already in use
  - Relevant sections reviewed: InitiateAuthCommand, AuthFlowType
  - Key patterns to follow: Cognito hosted UI integration for social logins

- **AWS Cognito Google Identity Provider**: Already configured in infrastructure
  - Provider configured in auth-stack.ts with proper attribute mappings
  - Google OAuth Client ID: 943111494407-autmunn4il0ea818amad2l5b8d1ud9l5.apps.googleusercontent.com (dev)

### Context7 Documentation Referenced

- Searched for AWS Cognito identity provider patterns
- Reviewed Google OAuth button branding guidelines
- Examined federated sign-in best practices with Cognito

## Acceptance Criteria (FROM ACTUAL JIRA TICKET)

- [x] **GIVEN** a user is on the `/signin` page **WHEN** they view the sign-in form **THEN** they should see a "Sign in with Google" button displayed prominently alongside the existing email/password form
- [x] **GIVEN** the Google sign-in button is displayed **WHEN** a user views the button **THEN** it should follow Google's official branding guidelines for sign-in buttons (proper logo, text, and styling)
- [x] **GIVEN** a user clicks the "Sign in with Google" button **WHEN** the button click event is triggered **THEN** the application should call the `AuthService.federatedSignIn('Google')` method from the auth-service.ts file
- [x] **GIVEN** the federated sign-in method is called **WHEN** the OAuth flow is initiated **THEN** the user should be redirected to Google's authentication page

## Definition of Done (FROM ACTUAL JIRA TICKET)

- [x] Google sign-in button implemented on `/signin` page
- [x] Button follows Google's branding guidelines
- [x] Button triggers the correct authentication method
- [x] Documentation updated to reflect new authentication option

## Technical Architecture

### System Components Affected

- Frontend: Sign-in page, authentication service, auth forms component
- Backend: No changes required (Google provider already configured in Cognito)
- Database: No changes required
- Infrastructure: No changes required (Google Identity Provider already set up)

### Authentication Flow

1. User clicks "Sign in with Google" button
2. Frontend initiates Cognito hosted UI flow with Google as provider
3. User redirected to Google OAuth consent screen
4. After approval, redirected back to Cognito callback URL
5. Cognito handles token exchange and user creation/mapping
6. Frontend receives tokens and stores in localStorage
7. User redirected to application homepage

## Implementation Tasks

### Frontend Tasks

#### Files to Modify

- `/home/gabriel/myProjects/fitnessfight.club/frontend/lib/auth.ts`: Add federatedSignIn function
- `/home/gabriel/myProjects/fitnessfight.club/frontend/components/auth-forms.tsx`: Add GoogleSignInButton component
- `/home/gabriel/myProjects/fitnessfight.club/frontend/app/signin/page.tsx`: Integrate Google sign-in button
- `/home/gabriel/myProjects/fitnessfight.club/frontend/lib/cognito-client.ts`: Add Cognito domain configuration

#### Tasks

- [x] Add COGNITO_DOMAIN environment variable to frontend configuration
- [x] Implement `federatedSignIn` function in auth.ts that constructs the Cognito hosted UI URL with Google provider
- [x] Create GoogleSignInButton component following Google's branding guidelines:
  - [x] Use official Google "G" logo SVG
  - [x] Apply proper button styling (white background, elevation, hover states)
  - [x] Include text "Sign in with Google" in Roboto font
  - [x] Ensure minimum 40px height as per guidelines
- [x] Add Google sign-in button to SignInContent component in signin/page.tsx
- [x] Position button prominently above or below email/password form with divider
- [x] Handle OAuth callback redirect and token parsing
- [x] Add loading state while OAuth flow is in progress
- [x] Handle OAuth errors and display user-friendly messages

### Backend Tasks

#### Files to Modify

- None required - Google Identity Provider already configured in Cognito

#### Tasks

- [ ] Verify Google OAuth Client Secret is properly set in AWS Secrets Manager
- [ ] Confirm callback URLs are correctly configured for dev environment

### Database Tasks

#### Schema Changes

- None required - Cognito handles user creation and attribute mapping

#### Tasks

- [ ] No database tasks needed

### Infrastructure Tasks

#### Resources to Update

- None - Google provider already configured in auth-stack.ts

#### Tasks

- [ ] Verify Google Identity Provider is properly deployed in dev environment
- [ ] Confirm OAuth redirect URIs match frontend configuration

## Testing Requirements

### Unit Tests

- [ ] `frontend/__tests__/lib/auth.test.ts`: Add tests for federatedSignIn function
  - Test URL construction with correct parameters
  - Test provider parameter validation
  - Test error handling for invalid providers

### Integration Tests

- [ ] Test complete OAuth flow in dev environment:
  - Click Google sign-in button
  - Complete Google authentication
  - Verify successful redirect back to application
  - Confirm user session is established
  - Verify user attributes are properly mapped

### End-to-End Tests

- [ ] Test Google sign-in from signin page
- [ ] Test handling of OAuth cancellation
- [ ] Test error scenarios (invalid credentials, network errors)
- [ ] Test session persistence after OAuth login
- [ ] Verify existing email/password login still works

## Success Metrics

- **Adoption Rate**: Percentage of new sign-ins using Google OAuth vs email/password
- **Time to Sign In**: Average time from landing on signin page to authenticated state
- **Error Rate**: Percentage of failed Google OAuth attempts
- **User Satisfaction**: Reduction in password reset requests

## Risk Mitigation

- **Risk 1 - OAuth Configuration Mismatch**: Ensure all redirect URLs match between Google Console, Cognito, and frontend
  - Mitigation: Document all URLs, test in dev before prod deployment
- **Risk 2 - Branding Guideline Violations**: Google may reject non-compliant implementations
  - Mitigation: Strictly follow Google's official branding guidelines, review before deployment
- **Risk 3 - Token Handling Security**: Improper token storage could expose user sessions
  - Mitigation: Use existing secure token storage in localStorage, implement proper token refresh

- **Risk 4 - User Confusion**: Users might not understand federated vs local accounts
  - Mitigation: Clear messaging about account types, handle duplicate email scenarios

## Dependencies

- External libraries:
  - @aws-sdk/client-cognito-identity-provider (already installed)
- Internal dependencies:
  - AWS Cognito User Pool with Google Identity Provider (already configured)
  - Google OAuth Client credentials (already in Secrets Manager)
- Team dependencies:
  - None - frontend implementation only

## Rollout Strategy

1. **Phase 1 - Development Environment**:
   - Deploy and test in dev environment
   - Conduct internal testing with team members
   - Verify all OAuth flows work correctly

2. **Phase 2 - Production Deployment**:
   - Deploy to production with feature flag (optional)
   - Monitor error rates and adoption metrics
   - Gradual rollout if using feature flag

3. **Phase 3 - Documentation**:
   - Update user documentation
   - Add FAQ for federated authentication
   - Document troubleshooting steps

## Implementation Notes

- The ticket mentions calling `AuthService.federatedSignIn('Google')` but this method doesn't exist yet
- Need to implement this method to construct the Cognito hosted UI URL
- Google provider is already configured in infrastructure, just needs frontend integration
- Must follow Google's branding guidelines exactly to avoid compliance issues
- Consider adding other social providers (GitHub, Facebook) in future iterations

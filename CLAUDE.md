# CLAUDE.md - AI Assistant Context

## Project Overview

Fitness Fight Club - A fitness tracking website integrated with Strava for club members to track activities and compete in challenges.

## AWS Resource Tagging

All AWS resources are tagged with:

- `Project: fitnessfight.club`
- `Environment: dev` or `prod`

These tags are automatically applied via CDK stack configuration for cost tracking and resource organization.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Infrastructure**: AWS CDK v2, CloudFront, S3, Route 53
- **Backend**: AWS Lambda (Node.js 20.x), API Gateway
- **Database**: DynamoDB (3 tables: users, activities, challenges)
- **Auth**: AWS Cognito with custom authentication pages + Strava OAuth
- **Auth Libraries**: AWS SDK v3 (@aws-sdk/client-cognito-identity-provider)
- **Secrets**: AWS Secrets Manager (Strava OAuth credentials)
- **CI/CD**: GitHub Actions
- **Monorepo**: npm workspaces (frontend/ and infrastructure/)

## Deployment Information

### Environments

- **Development**: Branch `develop` → Stack `fitnessfight-club-dev-Stack`
- **Production**: Branch `main` → Stack `fitnessfight-club-prod-Stack`

### Domain Configuration

- **Hosted Zone ID**: Z06109431OYB2L4NNQW58 (fitnessfight.club)
- **Development Domains**:
  - Frontend: dev.fitnessfight.club
  - API: api.dev.fitnessfight.club
- **Production Domains**:
  - Frontend: fitnessfight.club, www.fitnessfight.club
  - API: api.fitnessfight.club

### Current Deployment URLs (Dev)

- **Frontend**: https://dev.fitnessfight.club (CloudFront: d3ry0nlojppxzx.cloudfront.net)
- **API**: https://api.dev.fitnessfight.club
- **Cognito User Pool**: Configured for email/password authentication

### AWS Resources

- **Region**: us-east-1
- **User Pool ID**: us-east-1_WZQNmXLsR
- **Cognito Client ID**: 4e8v9397gd8hf53k4kt76j0e78
- **S3 Bucket**: fitnessfight-club-frontend-dev
- **CloudFront Distribution**: EDU3AJQMLEL5M
- **Lambda Function**: fitnessfight-club-api-dev
- **DynamoDB Tables**:
  - fitnessfight-club-users-dev (Primary Key: userId - stores Strava users)
  - fitnessfight-club-activities-dev
  - fitnessfight-club-challenges-dev
- **Secrets Manager**:
  - fitnessfight-club-strava-client-id-dev
  - fitnessfight-club-strava-client-secret-dev

## Development Commands

### Environment Setup

```bash
# Copy environment template and configure
cp frontend/.env.local.example frontend/.env.local
# Edit .env.local with your Cognito User Pool ID and Client ID from CDK outputs
```

### Local Development

```bash
# Start frontend dev server
npm run dev

# Run all tests
npm test

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run quality checks (lint + typecheck + test)
npm run quality

# Build all workspaces
npm run build
```

### Infrastructure Commands

```bash
# Deploy to AWS (from infrastructure directory)
cd infrastructure
npm run deploy -- --context environment=dev

# Synthesize CDK (check for errors)
npm run synth -- --context environment=dev

# View CDK diff
npm run diff -- --context environment=dev
```

### Git Workflow

Deployments happen automatically via GitHub Actions:

1. Push to `develop` branch → Deploys to dev environment
2. Push to `main` branch → Deploys to prod environment

See `gitWorkflow.md` for detailed deployment process.

## Project Structure

```
fitnessfight.club/
├── frontend/                 # Next.js application
│   ├── app/                 # App Router pages
│   │   ├── signin/         # Sign-in page
│   │   ├── signup/         # Sign-up page
│   │   ├── forgot-password/ # Password reset initiation
│   │   └── reset-password/  # Password reset completion
│   │   ├── components/          # React components
│   │   ├── header.tsx      # Navigation header with auth state
│   │   ├── auth-provider.tsx # Authentication context provider
│   │   ├── auth-forms.tsx  # Reusable auth form components
│   │   └── strava-connect-button.tsx # Strava OAuth connection button
│   └── lib/                 # Utilities and helpers
│       ├── auth.ts         # Client-side auth functions using AWS SDK
│       ├── cognito-client.ts # Cognito client configuration and token management
│       ├── auth-errors.ts  # User-friendly error mapping
│       └── config.ts       # Environment configuration
├── infrastructure/          # AWS CDK infrastructure
│   ├── lib/                # Stack definitions
│   │   ├── fitnessfight-stack.ts    # Main stack
│   │   ├── auth-stack.ts            # Cognito setup
│   │   ├── certificate-stack.ts     # ACM certificate for custom domains
│   │   ├── database-stack.ts        # DynamoDB tables with GSI
│   │   └── api-stack.ts             # Lambda + API Gateway with NodejsFunction
│   ├── lambda/             # Lambda function code
│   │   └── api/
│   │       ├── index.js    # API handler with JWT validation
│   │       ├── auth.js     # JWT verification utilities
│   │       ├── rateLimit.js # Rate limiting middleware
│   │       └── package.json # Lambda dependencies (bundled with NodejsFunction)
│   ├── test/              # CDK tests
│   └── bin/               # CDK app entry point
└── .github/               # GitHub Actions workflows
    └── workflows/
        ├── develop.yml    # Dev deployment
        └── main.yml       # Prod deployment
```

## Authentication System

### AWS Cognito Authentication

1. **Sign-up Flow**: Users register with email/password, receive verification code
2. **Sign-in Flow**: Authenticated users receive JWT tokens stored in localStorage
3. **Password Reset**: Forgot password flow with email verification
4. **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and numbers
5. **Session Management**: Automatic token refresh before expiration
6. **Auth State**: Header component displays user state (login/logout buttons)

### Security Features

- **Rate Limiting**:
  - Sign-in: 5 attempts per 15 minutes
  - Sign-up: 3 attempts per hour
  - Password reset: 3 attempts per 30 minutes
- **JWT Validation**: All API endpoints validate Cognito JWT tokens
- **Encrypted State**: OAuth state parameters encrypted with AES-256-GCM
- **Environment Validation**: Required environment variables validated at startup

## Strava OAuth Integration

### OAuth Flow (Requires Cognito Authentication)

1. User must be authenticated with Cognito first
2. Authenticated user clicks "Connect with Strava" button on homepage
3. Frontend calls `/api/v1/auth/strava` with JWT token to get authorization URL
4. User is redirected to Strava for authorization
5. Strava redirects to `/api/v1/auth/strava/callback` with code and encrypted state
6. Lambda decrypts state to get cognitoId, exchanges code for tokens, links with Cognito user
7. User is redirected to homepage with success message

### Token Management

- **Storage**: User tokens stored in DynamoDB users table
- **Auto-Refresh**: Tokens automatically refresh before expiry (6-hour lifetime)
- **Helper Functions**:
  - `getValidStravaToken(athleteId)` - Returns valid token, auto-refreshes if needed
  - `refreshStravaToken(userId)` - Manually refresh expired token

### User Data Structure in DynamoDB

```javascript
{
  userId: "22415995",        // Primary key (Strava athlete ID as string)
  cognitoId: "abc-123...",   // Cognito user ID (GSI for lookups)
  stravaId: "22415995",      // For GSI lookups
  athleteId: 22415995,       // Numeric athlete ID
  firstName: "Gabriel",
  lastName: "Beal",
  username: "bealg",
  email: "user@example.com", // From Cognito
  emailVerified: true,        // Email verification status
  authProvider: "cognito-strava", // Auth method tracking
  accessToken: "xxx...",     // Encrypted at rest
  refreshToken: "xxx...",    // For token refresh
  expiresAt: 1755846374,     // Unix timestamp
  createdAt: "2025-08-22...",
  updatedAt: "2025-08-22..."
}
```

### Strava Configuration

- **Callback Domain**: Set to base domain in Strava app settings (e.g., `fitnessfight.club`)
- **Permissions**: `activity:read_all` - View all activities
- **Credentials**: Stored in AWS Secrets Manager

### Strava Webhook Integration

- **Webhook URLs**:
  - Dev: `https://api.dev.fitnessfight.club/api/v1/webhook/strava`
  - Prod: `https://api.fitnessfight.club/api/v1/webhook/strava`
- **Verify Token**: Auto-generated during CDK deployment, stored in Lambda environment
- **Events Received**: `activity.create`, `activity.update`, `activity.delete`
- **Automatic Setup**: Webhook subscription is managed via GitHub Actions
  - Created automatically after successful CDK deployment
  - Idempotent script checks for existing subscriptions
  - Only creates new subscription if needed
  - Script location: `/scripts/strava-webhook-subscribe.js`
- **Manual Webhook Setup** (if needed):
  ```bash
  # Run subscription script manually
  node scripts/strava-webhook-subscribe.js dev   # For dev environment
  node scripts/strava-webhook-subscribe.js prod  # For prod environment
  ```
- **View Webhook Logs**:
  ```bash
  # View incoming webhook events
  aws logs tail /aws/lambda/fitnessfight-club-api-dev --follow
  ```

## Testing Strategy

- **Frontend Tests**: Jest + React Testing Library
- **Infrastructure Tests**: Jest for CDK snapshots
- **Pre-commit**: Prettier formatting via lint-staged
- **Pre-push**: Runs all tests automatically
- **CI/CD**: Tests run on every push before deployment

## API Endpoints

### Implemented

- `GET /api/v1/health` - Health check endpoint (no auth required) ✅
- `GET /api/v1/auth/strava` - Initiate Strava OAuth flow (requires JWT) ✅
- `GET /api/v1/auth/strava/callback` - Handle Strava OAuth callback ✅
- `GET /api/v1/webhook/strava` - Handle Strava webhook verification (no auth) ✅
- `POST /api/v1/webhook/strava` - Receive Strava activity events (no auth) ✅

**Note**: All endpoints except health and webhook require valid Cognito JWT token in Authorization header

### To Be Implemented

- `GET /api/v1/users/{userId}` - Get user profile
- `POST /api/v1/activities` - Create activity
- `GET /api/v1/activities` - List activities
- `GET /api/v1/challenges` - List challenges
- `POST /api/v1/challenges` - Create challenge

## Notes for Future Development

### Completed ✅

- ~~AWS Cognito authentication~~ - Complete with sign-up, sign-in, email verification, password reset
- ~~Strava OAuth integration~~ - Complete with token storage and auto-refresh, gated behind Cognito auth
- ~~Domain fitnessfight.club configured in Route 53~~ - Both dev and prod domains working
- ~~Environment variables stored in AWS Secrets Manager~~ - Strava credentials secured
- ~~Webhook support for real-time Strava activity updates~~ - Automatically managed via GitHub Actions
- ~~User registration/login flows with Cognito~~ - Custom auth pages with JWT validation
- ~~Strava connection status display~~ - Shows "Strava Connected" when linked
- ~~Auth state persistence~~ - Tokens stored in localStorage survive page redirects

### To Do

1. Implement remaining API endpoints for users, activities, and challenges
2. Frontend buttons ("Get Started", "Learn More") need functionality
3. Add CloudWatch alarms for monitoring
4. Fetch and display Strava activities using stored tokens
5. Implement challenge creation and leaderboard functionality
6. Process webhook events to store activities in DynamoDB
7. Add user profile page with connected services management
8. Implement team/club functionality
9. Add proper error handling and user feedback for API failures
10. Implement token refresh logic before expiration

## Setup Requirements

### OAuth App Configuration

#### Google OAuth

1. Use Google Cloud Console to manage OAuth credentials
2. CDK creates secrets with placeholder values that must be manually updated
3. After deployment, update the Google OAuth client secret in AWS Secrets Manager:

   ```bash
   # For dev environment
   aws secretsmanager put-secret-value \
     --secret-id fitnessfight-club-google-client-secret-dev \
     --secret-string "YOUR_ACTUAL_GOOGLE_CLIENT_SECRET" \
     --region us-east-1

   # For prod environment
   aws secretsmanager put-secret-value \
     --secret-id fitnessfight-club-google-client-secret-prod \
     --secret-string "YOUR_ACTUAL_GOOGLE_CLIENT_SECRET" \
     --region us-east-1
   ```

#### Strava OAuth

1. Create a Strava app at https://www.strava.com/settings/api
2. Set Authorization Callback Domain to your base domain (e.g., `fitnessfight.club` for prod)
3. Update AWS Secrets Manager with your Client ID and Client Secret:
   - Dev: `fitnessfight-club-strava-client-id-dev` and `fitnessfight-club-strava-client-secret-dev`
   - Prod: `fitnessfight-club-strava-client-id-prod` and `fitnessfight-club-strava-client-secret-prod`

### First-Time Deployment

1. Deploy infrastructure: `cd infrastructure && npm run deploy -- --context environment=dev`
2. Update Secrets Manager with OAuth credentials:
   - Google OAuth client secret (see Google OAuth section above)
   - Strava OAuth credentials (see Strava OAuth section above)
3. Copy CDK output values to `frontend/.env.local`:
   - User Pool ID
   - User Pool Client ID
   - API URL
4. Test authentication flow at https://dev.fitnessfight.club:
   - Sign up with email/password
   - Verify email
   - Sign in
   - Connect Strava account

## Common Issues & Solutions

- **Tests failing in CI**: Ensure Lambda code is not gitignored (check `!infrastructure/lambda/**/*.js` in .gitignore)
- **CDK Deprecation warnings**: Use `pointInTimeRecoverySpecification` instead of `pointInTimeRecovery` for DynamoDB
- **Conventional commits**: Removed - no longer enforced by Husky
- **Strava OAuth errors**: Check callback domain configuration and ensure secrets are updated in AWS
- **Google OAuth errors**: Ensure the Google client secret has been manually updated in AWS Secrets Manager after CDK deployment
- **Cognito errors**: Ensure environment variables are set in `.env.local` from CDK outputs
- **Auth state lost after redirect**: Tokens are now stored in localStorage (fixed)
- **Lambda missing dependencies**: Use NodejsFunction for automatic bundling
- **CORS errors**: Lambda returns specific origin headers, not wildcards
- **JWT validation failures**: Check that Authorization header includes "Bearer " prefix
- **Rate limiting**: If locked out during testing, wait for timeout or restart Lambda function

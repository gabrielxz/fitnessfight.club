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
- **Auth**: AWS Cognito with Hosted UI + Strava OAuth
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

- **Frontend**: https://d3ry0nlojppxzx.cloudfront.net
- **API**: https://w0o2dsv2k8.execute-api.us-east-1.amazonaws.com/dev/
- **Cognito Hosted UI**: https://fitnessfight-club-dev.auth.us-east-1.amazoncognito.com

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
│   ├── components/          # React components
│   └── lib/                 # Utilities and helpers
├── infrastructure/          # AWS CDK infrastructure
│   ├── lib/                # Stack definitions
│   │   ├── fitnessfight-stack.ts    # Main stack
│   │   ├── auth-stack.ts            # Cognito setup
│   │   ├── database-stack.ts        # DynamoDB tables
│   │   └── api-stack.ts             # Lambda + API Gateway
│   ├── lambda/             # Lambda function code
│   │   └── api/
│   │       └── index.js   # API handler
│   └── test/              # CDK tests
└── .github/               # GitHub Actions workflows
    └── workflows/
        ├── develop.yml    # Dev deployment
        └── main.yml       # Prod deployment
```

## Strava OAuth Integration

### OAuth Flow

1. User clicks "Connect with Strava" button on homepage
2. Frontend calls `/api/v1/auth/strava` to get authorization URL
3. User is redirected to Strava for authorization
4. Strava redirects to `/api/v1/auth/strava/callback` with code
5. Lambda exchanges code for tokens and saves user to DynamoDB
6. User is redirected to homepage with success message

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
  stravaId: "22415995",      // For GSI lookups
  athleteId: 22415995,       // Numeric athlete ID
  firstName: "Gabriel",
  lastName: "Beal",
  username: "bealg",
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

## Testing Strategy

- **Frontend Tests**: Jest + React Testing Library
- **Infrastructure Tests**: Jest for CDK snapshots
- **Pre-commit**: Prettier formatting via lint-staged
- **Pre-push**: Runs all tests automatically
- **CI/CD**: Tests run on every push before deployment

## API Endpoints

### Implemented

- `GET /api/v1/health` - Health check endpoint ✅
- `GET /api/v1/auth/strava` - Initiate Strava OAuth flow ✅
- `GET /api/v1/auth/strava/callback` - Handle Strava OAuth callback ✅

### To Be Implemented

- `GET /api/v1/users/{userId}` - Get user profile
- `POST /api/v1/activities` - Create activity
- `GET /api/v1/activities` - List activities
- `GET /api/v1/challenges` - List challenges
- `POST /api/v1/challenges` - Create challenge

## Notes for Future Development

### Completed ✅

- ~~Strava OAuth integration~~ - Complete with token storage and auto-refresh
- ~~Domain fitnessfight.club configured in Route 53~~ - Both dev and prod domains working
- ~~Environment variables stored in AWS Secrets Manager~~ - Strava credentials secured

### To Do

1. Implement remaining API endpoints for users, activities, and challenges
2. Frontend buttons ("Get Started", "Learn More") need functionality beyond OAuth
3. Add CloudWatch alarms for monitoring
4. Add user registration/login flows with Cognito (in addition to Strava)
5. Fetch and display Strava activities using stored tokens
6. Implement challenge creation and leaderboard functionality
7. Add webhook support for real-time Strava activity updates

## Setup Requirements

### Strava App Configuration

1. Create a Strava app at https://www.strava.com/settings/api
2. Set Authorization Callback Domain to your base domain (e.g., `fitnessfight.club` for prod)
3. Update AWS Secrets Manager with your Client ID and Client Secret:
   - Dev: `fitnessfight-club-strava-client-id-dev` and `fitnessfight-club-strava-client-secret-dev`
   - Prod: `fitnessfight-club-strava-client-id-prod` and `fitnessfight-club-strava-client-secret-prod`

### First-Time Deployment

1. Deploy infrastructure: `cd infrastructure && npm run deploy -- --context environment=dev`
2. Update Secrets Manager with Strava credentials (see above)
3. Test OAuth flow at https://dev.fitnessfight.club

## Common Issues & Solutions

- **Tests failing in CI**: Ensure Lambda code is not gitignored (check `!infrastructure/lambda/**/*.js` in .gitignore)
- **CDK Deprecation warnings**: Use `pointInTimeRecoverySpecification` instead of `pointInTimeRecovery` for DynamoDB
- **Conventional commits**: Removed - no longer enforced by Husky
- **Strava OAuth errors**: Check callback domain configuration and ensure secrets are updated in AWS

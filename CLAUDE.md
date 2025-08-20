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
- **Auth**: AWS Cognito with Hosted UI
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
  - fitnessfight-club-users-dev
  - fitnessfight-club-activities-dev
  - fitnessfight-club-challenges-dev

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

## Testing Strategy

- **Frontend Tests**: Jest + React Testing Library
- **Infrastructure Tests**: Jest for CDK snapshots
- **Pre-commit**: Prettier formatting via lint-staged
- **Pre-push**: Runs all tests automatically
- **CI/CD**: Tests run on every push before deployment

## API Endpoints (To Be Implemented)

- `GET /api/health` - Health check endpoint
- `GET /api/users/{userId}` - Get user profile
- `POST /api/activities` - Create activity
- `GET /api/activities` - List activities
- `GET /api/challenges` - List challenges
- `POST /api/challenges` - Create challenge

## Notes for Future Development

1. The Lambda function currently returns 404 for all routes - needs implementation
2. Frontend buttons ("Get Started", "Learn More") need functionality
3. Strava OAuth integration needs to be set up
4. Domain fitnessfight.club needs to be configured in Route 53
5. Environment variables for API keys should be stored in AWS Secrets Manager
6. Consider adding CloudWatch alarms for monitoring
7. Add user registration/login flows with Cognito
8. Implement data models for users, activities, and challenges

## Common Issues & Solutions

- **Tests failing in CI**: Ensure Lambda code is not gitignored (check `!infrastructure/lambda/**/*.js` in .gitignore)
- **CDK Deprecation warnings**: Use `pointInTimeRecoverySpecification` instead of `pointInTimeRecovery` for DynamoDB
- **Conventional commits**: Removed - no longer enforced by Husky

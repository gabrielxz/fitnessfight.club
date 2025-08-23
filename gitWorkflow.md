# Git Workflow & Deployment Process

## Overview

This document describes the deployment process for fitnessfight.club, including Git workflow, testing requirements, and CI/CD pipeline.

## Environments

- **Development** (`dev`): Deployed from `develop` branch
- **Production** (`prod`): Deployed from `main` branch

## Branch Strategy

```
main (production)
  └── develop (development)
       └── feature/* (feature branches)
```

## Local Development Workflow

### 1. Pre-commit Checks

Before any commit, the following checks must pass locally:

```bash
# Run all checks
npm run lint        # ESLint checks
npm run typecheck   # TypeScript type checking
npm test           # Run all tests
npm run build      # Ensure build succeeds
```

### 2. Feature Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: your feature description"

# Push to remote
git push origin feature/your-feature-name
```

### 3. Creating Pull Requests

1. Push feature branch to GitHub
2. Create PR targeting `develop` branch
3. Wait for automated checks to pass
4. Request code review if required
5. Merge after approval

## Automated CI/CD Pipeline

### Pull Request Validation

**Triggered by:** Opening or updating a PR
**Actions:**

1. Install dependencies
2. Run linting (`npm run lint`)
3. Run type checking (`npm run typecheck`)
4. Run tests (`npm test`)
5. Build frontend (`npm run build --workspace=frontend`)
6. Synthesize CDK (`npm run synth --workspace=infrastructure`)

### Development Deployment

**Triggered by:** Push to `develop` branch
**Actions:**

1. **Test & Lint Phase**
   - Run linting
   - Run type checking
   - Run all tests
2. **Build Phase**
   - Build Next.js static export
   - Upload artifacts
3. **Deploy Phase**
   - Configure AWS credentials
   - Bootstrap CDK (if needed)
   - Deploy CDK stack to dev environment
   - Update CloudFront distribution

**Output:** https://[cloudfront-dev-id].cloudfront.net

### Production Deployment

**Triggered by:** Push to `main` branch
**Actions:**

1. **Test & Lint Phase** (same as dev)
2. **Build Phase** (same as dev)
3. **Deploy Phase**
   - Deploy to production environment
   - Create Git tag for deployment
   - Retain artifacts for 7 days

**Output:** https://[cloudfront-prod-id].cloudfront.net

## Deployment Requirements

### GitHub Secrets Required

Configure these in GitHub Settings → Secrets:

- `AWS_ACCESS_KEY_ID`: AWS IAM access key
- `AWS_SECRET_ACCESS_KEY`: AWS IAM secret key
- `AWS_ACCOUNT_ID`: Your AWS account ID

### AWS Permissions Required

The IAM user needs these permissions:

- CloudFormation: Full access
- S3: Full access
- CloudFront: Full access
- IAM: Limited (for CDK roles)
- Lambda: Full access (for CDK custom resources)

## Manual Deployment

### Deploy to Development

```bash
# Build frontend
npm run build --workspace=frontend

# Deploy infrastructure
cd infrastructure
npm run deploy:dev
```

### Deploy to Production

```bash
# Build frontend
npm run build --workspace=frontend

# Deploy infrastructure
cd infrastructure
ENVIRONMENT=prod npm run deploy:prod
```

## Rollback Procedures

### Development Environment

```bash
# List recent deployments
aws cloudformation list-stacks --region us-east-1

# Rollback to previous version
cd infrastructure
cdk deploy fitnessfight-club-dev-Stack --rollback
```

### Production Environment

1. Identify the last working Git tag
2. Checkout the tag: `git checkout prod-YYYYMMDD-HHMMSS`
3. Deploy: `ENVIRONMENT=prod npm run deploy:prod --workspace=infrastructure`

## Monitoring Deployments

### GitHub Actions

- Check workflow runs: https://github.com/[your-username]/fitnessfight.club/actions
- View deployment logs in each workflow run
- Check deployment summaries in workflow artifacts

### AWS Console

- CloudFormation: Check stack status and events
- CloudFront: Monitor distribution status
- S3: Verify bucket contents

## Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Required

**Error:** "This stack uses assets, so the toolkit stack must be deployed"
**Solution:**

```bash
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

#### 2. Build Failures

**Error:** "Build failed"
**Solution:**

```bash
# Clear caches
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 3. Type Errors

**Error:** TypeScript compilation errors
**Solution:**

```bash
npm run typecheck -- --listFiles  # Find problematic files
npm run typecheck                  # Fix and rerun
```

#### 4. CDK Synth Failures

**Error:** "Unable to synthesize stack"
**Solution:**

```bash
cd infrastructure
npm run build
npm run synth
```

## Best Practices

1. **Always run tests locally** before pushing
2. **Never commit directly to main** - always use PRs
3. **Keep commits atomic** - one feature/fix per commit
4. **Write descriptive commit messages** following conventional commits
5. **Update tests** when adding new features
6. **Monitor deployments** through GitHub Actions
7. **Tag production releases** for easy rollback

## Emergency Procedures

### Production Down

1. Check CloudFront distribution status in AWS Console
2. Check CloudFormation stack status
3. Rollback to last known good tag if needed
4. Contact team lead if rollback fails

### Urgent Hotfix

1. Create hotfix branch from `main`
2. Apply fix and test thoroughly
3. Create PR directly to `main`
4. Deploy immediately after merge
5. Cherry-pick fix back to `develop`

## Support

For deployment issues:

1. Check GitHub Actions logs
2. Review CloudFormation events in AWS Console
3. Check this documentation
4. Contact DevOps team if unresolved

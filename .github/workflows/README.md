# GitHub Actions CI/CD Workflows

## Overview

This directory contains GitHub Actions workflows for automated testing and deployment of fitnessfight.club.

## Workflows

### 1. `develop.yml` - Development Deployment

- **Trigger:** Push to `develop` branch
- **Purpose:** Deploy to development environment
- **Steps:** Test → Build → Deploy to AWS (dev)
- **Output:** Development CloudFront URL

### 2. `main.yml` - Production Deployment

- **Trigger:** Push to `main` branch
- **Purpose:** Deploy to production environment
- **Steps:** Test → Build → Deploy to AWS (prod) → Create Git tag
- **Output:** Production CloudFront URL

### 3. `pull-request.yml` - PR Validation

- **Trigger:** Pull request events
- **Purpose:** Validate code before merge
- **Steps:** Lint → Type check → Test → Build → CDK synth

### 4. `manual-deploy.yml` - Manual Deployment

- **Trigger:** Manual workflow dispatch
- **Purpose:** Deploy to any environment on demand
- **Options:**
  - Environment selection (dev/prod)
  - Option to skip tests (emergency deployments)

### 5. `reusable-test.yml` - Reusable Test Workflow

- **Trigger:** Called by other workflows
- **Purpose:** Shared testing logic
- **Steps:** Lint → Type check → Test

## Required GitHub Secrets

Configure these in: Settings → Secrets and variables → Actions

| Secret Name             | Description             | Example        |
| ----------------------- | ----------------------- | -------------- |
| `AWS_ACCESS_KEY_ID`     | AWS IAM user access key | `AKIA...`      |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM user secret key | `wJal...`      |
| `AWS_ACCOUNT_ID`        | Your AWS account ID     | `123456789012` |

## Required AWS IAM Permissions

The IAM user needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "cloudfront:*",
        "iam:*",
        "lambda:*",
        "logs:*",
        "ssm:GetParameter",
        "route53:*",
        "acm:*",
        "cognito-idp:*",
        "dynamodb:*",
        "apigateway:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## GitHub Environments

Configure these in: Settings → Environments

### Development Environment

- **Name:** `development`
- **Protection rules:** None
- **Deployment branches:** `develop`

### Production Environment

- **Name:** `production`
- **Protection rules:**
  - Required reviewers (optional)
  - Wait timer (optional, e.g., 5 minutes)
- **Deployment branches:** `main`

## Monitoring Workflows

### View Workflow Runs

1. Go to Actions tab in GitHub
2. Filter by workflow name
3. Click on a run to see details

### Workflow Status Badges

Add to README.md:

```markdown
![Development](https://github.com/yourusername/fitnessfight.club/actions/workflows/develop.yml/badge.svg)
![Production](https://github.com/yourusername/fitnessfight.club/actions/workflows/main.yml/badge.svg)
```

## Troubleshooting

### Common Issues

#### AWS Credentials Error

**Error:** "Could not load credentials from any providers"
**Solution:** Check GitHub Secrets are correctly set

#### CDK Bootstrap Error

**Error:** "This stack uses assets, so the toolkit stack must be deployed"
**Solution:** The workflow includes automatic bootstrap, but ensure AWS credentials have sufficient permissions

#### Build Artifacts Not Found

**Error:** "Unable to find artifact"
**Solution:** Check previous job completed successfully

#### Timeout Errors

**Error:** "The job was cancelled because it reached the timeout"
**Solution:** Increase timeout in workflow or optimize build process

## Best Practices

1. **Test locally first** - Run `npm test` before pushing
2. **Use PR workflow** - Always create PRs for code review
3. **Monitor deployments** - Check Actions tab after pushing
4. **Keep secrets secure** - Never commit AWS credentials
5. **Use environments** - Leverage GitHub Environments for protection
6. **Tag releases** - Production deployments auto-create tags

## Manual Deployment

To trigger a manual deployment:

1. Go to Actions tab
2. Select "Manual Deployment" workflow
3. Click "Run workflow"
4. Select environment and options
5. Click "Run workflow" button

## Emergency Procedures

### Rollback Production

1. Find last working tag: `git tag -l "prod-*"`
2. Checkout tag: `git checkout prod-YYYYMMDD-HHMMSS`
3. Push to main: `git push origin HEAD:main --force`

### Skip CI

Add `[skip ci]` to commit message to skip workflows:

```bash
git commit -m "Emergency fix [skip ci]"
```

## Support

For CI/CD issues:

1. Check workflow logs in Actions tab
2. Verify GitHub Secrets are set
3. Check AWS IAM permissions
4. Review this documentation

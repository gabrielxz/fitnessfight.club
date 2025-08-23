#!/bin/bash

# GitHub Secrets Setup Script
# This script helps you set up the required GitHub secrets for CI/CD

set -e

echo "========================================="
echo "GitHub Secrets Setup for fitnessfight.club"
echo "========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "Error: Not logged in to GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

# Get repository name
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo "Error: Not in a GitHub repository or repository not found."
    exit 1
fi

echo "Repository: $REPO"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_value=$2
    
    echo "Setting secret: $secret_name"
    echo "$secret_value" | gh secret set "$secret_name" --repo="$REPO"
}

# Prompt for AWS credentials
echo "Please enter your AWS credentials:"
echo "(These will be stored as GitHub secrets, not locally)"
echo ""

read -p "AWS Account ID: " AWS_ACCOUNT_ID
read -p "AWS Access Key ID: " AWS_ACCESS_KEY_ID
read -s -p "AWS Secret Access Key: " AWS_SECRET_ACCESS_KEY
echo ""
echo ""

# Confirm before setting secrets
echo "Ready to set the following secrets:"
echo "  - AWS_ACCOUNT_ID"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo ""
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Aborted."
    exit 0
fi

# Set the secrets
set_secret "AWS_ACCOUNT_ID" "$AWS_ACCOUNT_ID"
set_secret "AWS_ACCESS_KEY_ID" "$AWS_ACCESS_KEY_ID"
set_secret "AWS_SECRET_ACCESS_KEY" "$AWS_SECRET_ACCESS_KEY"

echo ""
echo "✅ GitHub secrets have been set successfully!"
echo ""
echo "Next steps:"
echo "1. Create GitHub Environments (development, production) in Settings → Environments"
echo "2. Push to 'develop' branch to trigger dev deployment"
echo "3. Create PR to 'main' branch for production deployment"
echo ""
echo "To verify secrets are set:"
echo "gh secret list --repo=$REPO"
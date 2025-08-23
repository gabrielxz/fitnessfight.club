#!/bin/bash

# Script to rebuild frontend with Cognito configuration
# Usage: ./scripts/rebuild-frontend.sh [dev|prod]

ENVIRONMENT=${1:-dev}
STACK_NAME="fitnessfight-club-${ENVIRONMENT}-Stack"

echo "Rebuilding frontend for environment: $ENVIRONMENT"

# Get Cognito IDs from deployed stack
echo "Getting Cognito configuration from CloudFormation..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" \
  --output text \
  --region us-east-1)

CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='AuthUserPoolClientId8216BF9A'].OutputValue" \
  --output text \
  --region us-east-1)

echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $CLIENT_ID"

if [ -z "$USER_POOL_ID" ] || [ -z "$CLIENT_ID" ]; then
  echo "Error: Could not get Cognito configuration from stack"
  exit 1
fi

# Build frontend with Cognito configuration
echo "Building frontend with Cognito configuration..."
cd frontend
NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID \
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$CLIENT_ID \
npm run build

# Upload to S3
echo "Uploading to S3..."
aws s3 sync out/ s3://fitnessfight-club-frontend-${ENVIRONMENT}/ --delete --region us-east-1

# Get CloudFront distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text \
  --region us-east-1)

# Invalidate CloudFront cache
if [ -n "$DISTRIBUTION_ID" ]; then
  echo "Invalidating CloudFront cache (Distribution: $DISTRIBUTION_ID)..."
  aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/*" \
    --region us-east-1
fi

echo "Frontend rebuilt and deployed successfully!"
echo "Visit: https://$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontURL'].OutputValue" \
  --output text \
  --region us-east-1)"
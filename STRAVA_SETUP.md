# Strava OAuth Setup Instructions

## Prerequisites

You need a Strava application to use the OAuth flow. If you don't have one:

1. Go to https://www.strava.com/settings/api
2. Create a new application
3. Note down your Client ID and Client Secret

## Setting Up Strava Credentials (AWS Secrets Manager)

The application stores Strava credentials securely in AWS Secrets Manager. After deploying the CDK stack, you need to update the placeholder values with your actual credentials.

### Via AWS Console (Recommended)

1. **Go to AWS Secrets Manager Console**
   - Navigate to: https://console.aws.amazon.com/secretsmanager/
   - Make sure you're in the correct region (us-east-1)

2. **Find and Update the Secrets**

   For **Development** environment:
   - Find secret: `fitnessfight-club-strava-client-id-dev`
   - Click on the secret name
   - Click "Retrieve secret value" to see current value
   - Click "Edit" and replace `PLACEHOLDER_CLIENT_ID` with your actual Strava Client ID
   - Click "Save"
   - Find secret: `fitnessfight-club-strava-client-secret-dev`
   - Click on the secret name
   - Click "Retrieve secret value" to see current value
   - Click "Edit" and replace `PLACEHOLDER_CLIENT_SECRET` with your actual Strava Client Secret
   - Click "Save"

   For **Production** environment:
   - Follow the same steps for:
     - `fitnessfight-club-strava-client-id-prod`
     - `fitnessfight-club-strava-client-secret-prod`

### Via AWS CLI

```bash
# For development environment
aws secretsmanager update-secret \
  --secret-id fitnessfight-club-strava-client-id-dev \
  --secret-string "YOUR_ACTUAL_CLIENT_ID" \
  --region us-east-1

aws secretsmanager update-secret \
  --secret-id fitnessfight-club-strava-client-secret-dev \
  --secret-string "YOUR_ACTUAL_CLIENT_SECRET" \
  --region us-east-1

# For production environment
aws secretsmanager update-secret \
  --secret-id fitnessfight-club-strava-client-id-prod \
  --secret-string "YOUR_ACTUAL_CLIENT_ID" \
  --region us-east-1

aws secretsmanager update-secret \
  --secret-id fitnessfight-club-strava-client-secret-prod \
  --secret-string "YOUR_ACTUAL_CLIENT_SECRET" \
  --region us-east-1
```

## Security Benefits

Using AWS Secrets Manager provides several advantages:

- **Encryption at rest**: Secrets are encrypted using AWS KMS
- **Access control**: IAM policies control who can read the secrets
- **Audit trail**: All access is logged in CloudTrail
- **Rotation support**: Easy to rotate credentials without redeploying
- **No hardcoded values**: Credentials never appear in code or environment variables

## Configure Strava Application

In your Strava application settings (https://www.strava.com/settings/api), you need to configure the **Authorization Callback Domain**.

**IMPORTANT**: Strava only requires the domain, NOT the full path. Enter only the domain part:

### For Development:

- Authorization Callback Domain: `api.dev.fitnessfight.club`
  - The actual callback URL will be: `https://api.dev.fitnessfight.club/api/v1/auth/strava/callback`
  - But you only enter: `api.dev.fitnessfight.club`
  - Note: Custom domains map directly to the stage, no stage prefix in path

### For Production:

- Authorization Callback Domain: `api.fitnessfight.club`
  - The actual callback URL will be: `https://api.fitnessfight.club/api/v1/auth/strava/callback`
  - But you only enter: `api.fitnessfight.club`
  - Note: Custom domains map directly to the stage, no stage prefix in path

### Common Issues:

- Do NOT include `https://` in the domain
- Do NOT include the path `/api/v1/auth/strava/callback`
- Do NOT include a trailing slash
- Make sure the domain matches exactly (including subdomain)

## Testing the Flow

1. Visit your application:
   - Dev: https://dev.fitnessfight.club
   - Prod: https://fitnessfight.club

2. Click "Connect with Strava" button

3. You'll be redirected to Strava to authorize the application

4. After authorization, you'll be redirected back to the homepage

5. Check CloudWatch logs for the Lambda function to see the logged user details

## OAuth Flow Overview

1. User clicks "Connect with Strava" → Frontend calls `/api/v1/auth/strava`
2. Backend returns Strava authorization URL
3. User is redirected to Strava for authorization
4. Strava redirects to `/api/v1/auth/strava/callback` with authorization code
5. Backend exchanges code for access token
6. User details are logged to console (CloudWatch)
7. User is redirected to homepage with success indicator

## Permissions Requested

The application requests the following Strava permissions:

- `activity:read_all` - View all activities (public and private)

## Troubleshooting

### "Strava client ID not configured" error

- Ensure STRAVA_CLIENT_ID environment variable is set in Lambda

### Token exchange fails

- Verify STRAVA_CLIENT_SECRET is correctly set
- Check that callback domain is configured in Strava app settings
- Ensure the environment (dev/prod) matches your testing URL

### CORS errors

- The API is configured to allow CORS from:
  - Dev: `https://dev.fitnessfight.club`, `http://localhost:3000`
  - Prod: `https://fitnessfight.club`, `https://www.fitnessfight.club`

## Next Steps

After successful OAuth implementation:

1. Store user tokens in DynamoDB users table
2. Implement token refresh mechanism (tokens expire after 6 hours)
3. Add endpoints to fetch user's Strava activities
4. Implement webhook subscriptions for real-time activity updates

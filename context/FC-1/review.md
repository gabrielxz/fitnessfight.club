# Code Review: FC-1

## Status: NEEDS_CHANGES

## Summary

The implementation successfully addresses the core requirements for processing Strava webhook events and displaying weekly training statistics. The code demonstrates good architectural patterns, proper error handling, and comprehensive test coverage. However, several critical and major issues need to be addressed before approval, particularly around security validation, performance optimization, and test reliability.

## Requirements Compliance

- ✅ Webhook events (create, update, delete) are processed and activities stored in DynamoDB
- ✅ Complete activity details are fetched from Strava API using stored user tokens
- ✅ Activities table stores required fields: activityId, userId, name, type, distance, duration, startDate
- ✅ GET /api/v1/users/{userId}/weekly-stats endpoint returns current week's training hours
- ✅ Frontend displays weekly training hours after authentication
- ✅ Week boundaries are Monday 00:00:00 to Sunday 23:59:59
- ✅ Duration is stored in seconds, displayed in hours (1 decimal place)
- ✅ Activities are properly updated when webhook update events are received
- ✅ Deleted activities are removed from calculations
- ❌ Lambda timeout not increased to 30 seconds as specified in plan

## Issues Found

### Critical Issues

1. **File:** infrastructure/lambda/api/index.js:607
   **Issue:** Unsafe JSON parsing without try-catch wrapper
   **Recommendation:** Wrap JSON.parse in try-catch to handle malformed webhook payloads gracefully:

   ```javascript
   let webhookEvent
   try {
     webhookEvent = body ? JSON.parse(body) : null
   } catch (error) {
     console.error('Invalid JSON in webhook body:', error)
     return {
       statusCode: 400,
       headers: corsHeaders,
       body: JSON.stringify({ error: 'Invalid request body' }),
     }
   }
   ```

2. **File:** infrastructure/lib/api-stack.ts
   **Issue:** Lambda timeout not configured as per requirements (should be 30 seconds for webhook processing)
   **Recommendation:** Add timeout configuration to Lambda function:

   ```typescript
   timeout: Duration.seconds(30),
   ```

3. **File:** infrastructure/lambda/api/index.js:639-701
   **Issue:** No webhook signature validation for security
   **Recommendation:** Strava webhooks should be validated using HMAC signature to prevent unauthorized webhook calls. Implement signature validation as per Strava documentation.

### Major Issues

1. **File:** infrastructure/lambda/api/index.js:852-882
   **Issue:** Weekly stats query doesn't handle pagination for users with many activities
   **Recommendation:** Add pagination support with Limit parameter and handle LastEvaluatedKey for large result sets

2. **File:** infrastructure/lambda/api/index.js:667-682
   **Issue:** Token refresh error handling doesn't update the database with new tokens
   **Recommendation:** After successful token refresh in webhook processing, update the user record in DynamoDB with new tokens

3. **File:** frontend/components/weekly-stats.tsx:38
   **Issue:** Using athleteId directly without validation
   **Recommendation:** Add validation to ensure athleteId exists and is valid before making API call

4. **File:** infrastructure/lambda/api/test files
   **Issue:** Test failures in Lambda tests (missing node-fetch mock, auth test failures)
   **Recommendation:** Fix test mocking issues and ensure all tests pass before deployment

### Minor Issues

1. **File:** infrastructure/lambda/api/index.js:281
   **Issue:** Excessive logging of entire event object in production
   **Recommendation:** Use conditional logging based on environment:

   ```javascript
   if (process.env.ENVIRONMENT === 'dev') {
     console.log('Event:', JSON.stringify(event, null, 2))
   }
   ```

2. **File:** frontend/components/weekly-stats.tsx:47
   **Issue:** Generic error messages don't help users understand the issue
   **Recommendation:** Provide more specific error messages based on error type (network, auth, etc.)

3. **File:** infrastructure/lambda/api/index.js:230-245
   **Issue:** Activity data structure doesn't validate required fields
   **Recommendation:** Add validation to ensure critical fields like startDate and duration are present

## Security Considerations

1. **Webhook Security**: The implementation lacks webhook signature validation, which is a critical security vulnerability. Any attacker could send fake webhook events to manipulate activity data.

2. **Input Validation**: While the code uses String() for type coercion, there's no validation of data ranges or formats (e.g., negative durations, future dates).

3. **Rate Limiting**: No rate limiting is implemented for webhook endpoints, making the system vulnerable to DoS attacks.

4. **Sensitive Data Logging**: The code logs entire event objects which might contain sensitive information.

## Performance Notes

1. **Database Queries**: The weekly stats endpoint performs multiple queries (user lookup + activities query) that could be optimized with better indexing strategy or caching.

2. **Token Refresh**: The token refresh logic in webhook processing could cause delays. Consider implementing async processing with SQS for webhook events.

3. **Lambda Cold Starts**: With date-fns added as a dependency, Lambda package size increases. Consider using native Date methods or lighter alternatives.

4. **Missing Pagination**: The weekly stats query doesn't implement pagination, which could cause issues for very active users.

## Test Coverage Assessment

1. **Good Coverage**: Webhook processing, weekly stats calculation, and frontend component have comprehensive test suites.

2. **Test Failures**: Lambda tests are currently failing due to missing dependencies and mock issues. This blocks CI/CD pipeline.

3. **Missing Tests**: No integration tests for the full webhook flow (receive → process → store → query).

4. **Edge Cases**: Tests cover week boundaries well but miss timezone edge cases.

## Positive Highlights

1. **Comprehensive Error Handling**: The code includes try-catch blocks and proper error logging throughout.

2. **Token Management**: Excellent implementation of automatic token refresh with proper fallback logic.

3. **Test Coverage**: Thorough test suites covering happy paths, error cases, and edge cases.

4. **Code Organization**: Clean separation of concerns with helper functions for specific tasks.

5. **Frontend UX**: Good loading states, error handling, and responsive design in the WeeklyStats component.

6. **Date Handling**: Proper use of date-fns for week calculations with Monday as start of week.

## Recommendations

1. **Immediate Actions**:
   - Add webhook signature validation for security
   - Fix Lambda timeout configuration to 30 seconds
   - Fix failing tests in Lambda package
   - Add try-catch around JSON.parse operations

2. **Near-term Improvements**:
   - Implement pagination for weekly stats queries
   - Add input validation for webhook payloads
   - Implement rate limiting for webhook endpoint
   - Add webhook event deduplication using activity ID

3. **Long-term Enhancements**:
   - Consider async processing with SQS for webhook events
   - Implement caching layer for frequently accessed data
   - Add monitoring and alerting for webhook processing failures
   - Consider using DynamoDB streams for activity aggregations

4. **Documentation**:
   - Add inline comments explaining the webhook processing flow
   - Document the expected webhook payload structure
   - Add error code documentation for API responses

The implementation shows strong technical competence and good understanding of the requirements. With the critical security issues addressed and test failures resolved, this will be a solid, production-ready feature.

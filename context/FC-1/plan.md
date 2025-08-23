# Technical Implementation Plan: Process and Display Strava Activity Data from Webhooks

## Ticket: FC-1

## Date: 2025-08-23

## Executive Summary

This plan outlines the implementation of a system to process Strava webhook events, fetch complete activity details from the Strava API, store activities in DynamoDB, and display weekly training statistics on the frontend. The solution will enable automatic tracking of Strava activities and provide members with weekly training hour summaries without manual updates.

## Library Research & Documentation

### Libraries Consulted

- **@aws-sdk/client-dynamodb** v3: AWS SDK for JavaScript
  - Relevant sections reviewed: DynamoDB Document Client, UpdateCommand, QueryCommand
  - Key patterns to follow: Using DynamoDBDocumentClient for simplified object mapping
- **date-fns** v3.5.0: [date-fns documentation](https://date-fns.org/)
  - Relevant sections reviewed: startOfWeek, endOfWeek, format functions
  - Key patterns to follow: Using Monday as start of week with `weekStartsOn: 1` option

- **Strava API** v3: [Strava API documentation](https://developers.strava.com/docs/)
  - Relevant sections reviewed: GET /activities/{id} endpoint for activity details
  - Key patterns to follow: Bearer token authentication, activity object schema

### Context7 Documentation Referenced

- AWS DynamoDB query operations with GSI usage patterns
- date-fns week boundary calculations with ISO week standards
- Strava API activity retrieval with proper authentication headers

## Acceptance Criteria

- [x] Webhook events (create, update, delete) are processed and activities stored in DynamoDB
- [x] Complete activity details are fetched from Strava API using stored user tokens
- [x] Activities table stores: activityId, userId, name, type, distance, duration, startDate
- [x] GET /api/v1/users/{userId}/weekly-stats endpoint returns current week's training hours
- [x] Frontend displays weekly training hours after authentication
- [x] Week boundaries are Monday 00:00:00 to Sunday 23:59:59
- [x] Duration is stored in seconds, displayed in hours (1 decimal place)
- [x] Activities are properly updated when webhook update events are received
- [x] Deleted activities are removed from calculations

## Technical Architecture

### System Components Affected

- Frontend: Homepage component with weekly stats display
- Backend: Lambda function API with new endpoints and webhook processing
- Database: Activities table for storing Strava activity data
- Infrastructure: No changes needed (existing tables and Lambda setup sufficient)

## Implementation Tasks

### Backend Tasks

#### Files to Modify

- `infrastructure/lambda/api/index.js`: Add webhook processing logic and new API endpoint
- `infrastructure/lambda/api/package.json`: Add date-fns dependency

#### Tasks

- [x] Install date-fns dependency in Lambda function
- [x] Create helper function `fetchStravaActivity(activityId, accessToken)` to get activity details
- [x] Create helper function `saveActivityToDynamoDB(activity, userId)` to store/update activities
- [x] Create helper function `deleteActivityFromDynamoDB(activityId, userId)` for deletions
- [x] Implement webhook event processing for activity.create events
- [x] Implement webhook event processing for activity.update events
- [x] Implement webhook event processing for activity.delete events
- [x] Create GET /api/v1/users/{userId}/weekly-stats endpoint
- [x] Implement week boundary calculation using date-fns (Monday to Sunday)
- [x] Query activities within current week using GSI userId-timestamp-index
- [x] Calculate total duration in hours from seconds
- [x] Add error handling for missing users or invalid tokens
- [x] Add automatic token refresh if Strava API returns 401

### Database Tasks

#### Schema Changes

- Activities table already exists with proper structure
- GSI userId-timestamp-index already configured for date range queries

#### Tasks

- [x] Define activity item structure with required fields
- [x] Ensure timestamp field is populated with Unix timestamp from startDate
- [x] Add isDeleted flag for soft deletes (optional)

### Frontend Tasks

#### Files to Modify

- `frontend/app/page.tsx`: Add weekly stats display component
- `frontend/lib/api.ts`: Add API client function for weekly stats

#### New Files to Create

- `frontend/components/weekly-stats.tsx`: Component to display weekly training hours

#### Tasks

- [x] Create WeeklyStats component with loading state
- [x] Add API call to fetch weekly stats for authenticated user
- [x] Display training hours with 1 decimal place formatting
- [x] Show "No activities this week" when hours = 0
- [x] Add error handling and retry logic
- [x] Style component to match existing design system
- [x] Add automatic refresh on Strava connection success
- [x] Display week date range (e.g., "Jan 20 - Jan 26")

### Infrastructure Tasks

#### Resources to Update

- None required - existing Lambda and DynamoDB tables are sufficient

#### Tasks

- [x] Verify Lambda has appropriate DynamoDB permissions for activities table
- [x] Ensure Lambda timeout is sufficient for webhook processing (30 seconds recommended)

## Testing Requirements

### Unit Tests

- [ ] `infrastructure/lambda/api/test/webhook.test.js`: Test webhook event processing logic
- [ ] `infrastructure/lambda/api/test/weekly-stats.test.js`: Test weekly stats calculation
- [ ] `frontend/components/__tests__/weekly-stats.test.tsx`: Test component rendering

### Integration Tests

- [ ] Test full webhook flow: receive event → fetch activity → store in DynamoDB
- [ ] Test weekly stats endpoint with various date ranges
- [ ] Test token refresh flow when accessing Strava API
- [ ] Test handling of deleted activities

### End-to-End Tests

- [ ] Connect Strava account and verify initial sync
- [ ] Create activity on Strava and verify it appears in weekly stats
- [ ] Update activity on Strava and verify stats update
- [ ] Delete activity on Strava and verify stats adjust
- [ ] Test week boundary transitions (Sunday to Monday)

## Success Metrics

- **Webhook Processing Time**: < 5 seconds per event
- **Weekly Stats Query Time**: < 500ms response time
- **Data Accuracy**: 100% match with Strava activity data
- **User Experience**: Stats visible within 10 seconds of activity creation

## Risk Mitigation

- **Strava API Rate Limits**: Implement exponential backoff and queue for batch processing
- **Token Expiration**: Auto-refresh tokens before making API calls
- **Webhook Duplicates**: Use idempotent operations with activity ID as key
- **Missing User Data**: Gracefully handle users without Strava connection
- **Large Activity Volume**: Implement pagination for weekly stats queries
- **Timezone Issues**: Store all times in UTC, convert for display

## Dependencies

- External libraries:
  - date-fns@^3.5.0 (for date calculations)
- Internal dependencies:
  - Existing getValidStravaToken helper function
  - Existing DynamoDB Document Client setup
  - Existing authentication system
- Team dependencies: None

## Implementation Details

### Activity Data Structure in DynamoDB

```javascript
{
  userId: "22415995",           // Partition key (Strava athlete ID)
  activityId: "10592383947",    // Sort key (Strava activity ID)
  name: "Morning Run",           // Activity name
  type: "Run",                   // Activity type
  distance: 5243.2,              // Distance in meters
  duration: 1825,                // Moving time in seconds
  elapsedTime: 2100,            // Total elapsed time in seconds
  startDate: "2024-01-22T13:30:00Z", // ISO 8601 format
  timestamp: 1705930200,         // Unix timestamp for GSI queries
  averageSpeed: 2.87,            // Meters per second
  maxSpeed: 4.2,                 // Meters per second
  averageHeartrate: 145,         // BPM (if available)
  maxHeartrate: 165,             // BPM (if available)
  elevationGain: 125.5,          // Meters
  clubId: "default",             // For future club support
  createdAt: "2024-01-22T14:00:00Z",
  updatedAt: "2024-01-22T14:00:00Z"
}
```

### Week Calculation Logic

```javascript
import { startOfWeek, endOfWeek } from 'date-fns'

// Get current week boundaries (Monday to Sunday)
const now = new Date()
const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
const weekEnd = endOfWeek(now, { weekStartsOn: 1 }) // Sunday 23:59:59

// Convert to Unix timestamps for DynamoDB query
const startTimestamp = Math.floor(weekStart.getTime() / 1000)
const endTimestamp = Math.floor(weekEnd.getTime() / 1000)
```

### Webhook Processing Flow

1. Receive webhook event with activity ID and athlete ID
2. Look up user in DynamoDB using athlete ID
3. Get valid Strava token (auto-refresh if needed)
4. Fetch complete activity details from Strava API
5. Transform and store activity in DynamoDB
6. Return success response to Strava

## Rollout Strategy

1. Deploy backend changes first with webhook processing
2. Monitor webhook events in CloudWatch for 24 hours
3. Deploy frontend changes to display weekly stats
4. Announce feature to users with instructions
5. Monitor for any performance issues or errors
6. Consider adding caching layer if query volume is high

## Future Enhancements

- Add activity type filtering (run only, bike only, etc.)
- Support for monthly and yearly statistics
- Activity streak tracking
- Personal records and achievements
- Club leaderboards and comparisons
- Export functionality for training data

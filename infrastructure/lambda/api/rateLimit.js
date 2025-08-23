/**
 * Simple in-memory rate limiter for Lambda
 * In production, use DynamoDB or ElastiCache for distributed rate limiting
 */

// Store request counts in memory (resets when Lambda cold starts)
const requestCounts = new Map()

// Configuration
const RATE_LIMIT_CONFIG = {
  signin: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  signup: { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 signups per hour
  resetPassword: { maxRequests: 3, windowMs: 30 * 60 * 1000 }, // 3 resets per 30 minutes
  default: { maxRequests: 100, windowMs: 60 * 1000 } // 100 requests per minute default
}

/**
 * Clean up old entries to prevent memory leak
 */
function cleanupOldEntries() {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.firstRequest > data.windowMs) {
      requestCounts.delete(key)
    }
  }
}

/**
 * Get rate limit key based on IP and endpoint
 */
function getRateLimitKey(ip, endpoint) {
  return `${ip}:${endpoint}`
}

/**
 * Check if request should be rate limited
 */
function checkRateLimit(ip, endpoint) {
  // Clean up old entries periodically
  if (Math.random() < 0.1) { // 10% chance to clean up
    cleanupOldEntries()
  }

  const config = RATE_LIMIT_CONFIG[endpoint] || RATE_LIMIT_CONFIG.default
  const key = getRateLimitKey(ip, endpoint)
  const now = Date.now()

  if (!requestCounts.has(key)) {
    requestCounts.set(key, {
      count: 1,
      firstRequest: now,
      windowMs: config.windowMs
    })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  const data = requestCounts.get(key)
  const timeElapsed = now - data.firstRequest

  if (timeElapsed > config.windowMs) {
    // Window has expired, reset counter
    requestCounts.set(key, {
      count: 1,
      firstRequest: now,
      windowMs: config.windowMs
    })
    return { allowed: true, remaining: config.maxRequests - 1 }
  }

  if (data.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((config.windowMs - timeElapsed) / 1000)
    return { 
      allowed: false, 
      remaining: 0,
      retryAfter
    }
  }

  // Increment counter
  data.count++
  return { allowed: true, remaining: config.maxRequests - data.count }
}

/**
 * Extract client IP from Lambda event
 */
function getClientIp(event) {
  // Try to get real IP from headers (if behind API Gateway/CloudFront)
  const xForwardedFor = event.headers?.['X-Forwarded-For'] || 
                        event.headers?.['x-forwarded-for']
  
  if (xForwardedFor) {
    // X-Forwarded-For may contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim()
  }

  // Fallback to source IP
  return event.requestContext?.identity?.sourceIp || 
         event.requestContext?.http?.sourceIp ||
         'unknown'
}

/**
 * Rate limiting middleware
 */
async function rateLimitMiddleware(event, endpoint) {
  const ip = getClientIp(event)
  const result = checkRateLimit(ip, endpoint)

  if (!result.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG[endpoint]?.maxRequests || RATE_LIMIT_CONFIG.default.maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + (result.retryAfter * 1000))
      },
      body: JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
        retryAfter: result.retryAfter
      })
    }
  }

  // Add rate limit headers to successful responses
  return {
    headers: {
      'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG[endpoint]?.maxRequests || RATE_LIMIT_CONFIG.default.maxRequests),
      'X-RateLimit-Remaining': String(result.remaining)
    }
  }
}

module.exports = {
  rateLimitMiddleware,
  getClientIp,
  checkRateLimit,
  RATE_LIMIT_CONFIG
}
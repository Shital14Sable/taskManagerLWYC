import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

// ===========================================
// Rate Limiting (in-memory, resets on cold start)
// ===========================================
// Limits: 100 requests per IP per minute (high enough for legitimate use)
// This protects during warm instances; on free tier, hitting limits just stops the function

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (prevent memory leak)
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();

  // Cleanup every ~100 requests
  if (rateLimitMap.size > 100) {
    cleanupRateLimits();
  }

  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limited
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }

  // Increment count
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetIn: entry.resetTime - now };
}

function getClientIp(event: HandlerEvent): string {
  // Netlify provides the real IP in x-nf-client-connection-ip
  return event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';
}

/**
 * CORS headers for the response
 */
function getCorsHeaders(origin: string | undefined): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.ALLOWED_ORIGIN,
  ].filter(Boolean);

  const originAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': originAllowed ? origin : allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

/**
 * Create a JSON response
 */
function jsonResponse(
  statusCode: number,
  body: TokenResponse | ErrorResponse,
  headers: Record<string, string>
): HandlerResponse {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * OAuth token exchange handler
 *
 * This function exchanges an authorization code for an access token.
 * It's called by the frontend after the user authorizes the app on GitHub.
 *
 * The client secret is kept server-side for security.
 */
export const handler: Handler = async (
  event: HandlerEvent,
  _context: HandlerContext
): Promise<HandlerResponse> => {
  const origin = event.headers.origin || event.headers.Origin;
  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  // Rate limiting check
  const clientIp = getClientIp(event);
  const rateLimit = checkRateLimit(clientIp);

  // Add rate limit headers
  const headersWithRateLimit = {
    ...corsHeaders,
    'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(rateLimit.resetIn / 1000).toString(),
  };

  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIp}`);
    return jsonResponse(
      429,
      { error: 'rate_limit_exceeded', error_description: 'Too many requests. Please try again later.' },
      { ...headersWithRateLimit, 'Retry-After': Math.ceil(rateLimit.resetIn / 1000).toString() }
    );
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return jsonResponse(
      405,
      { error: 'method_not_allowed', error_description: 'Only POST requests are allowed' },
      headersWithRateLimit
    );
  }

  // Validate environment variables
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing GitHub OAuth configuration');
    return jsonResponse(
      500,
      { error: 'server_error', error_description: 'OAuth not configured' },
      headersWithRateLimit
    );
  }

  // Parse request body
  let code: string;
  try {
    const body = JSON.parse(event.body || '{}');
    code = body.code;
  } catch {
    return jsonResponse(
      400,
      { error: 'invalid_request', error_description: 'Invalid JSON body' },
      headersWithRateLimit
    );
  }

  if (!code) {
    return jsonResponse(
      400,
      { error: 'invalid_request', error_description: 'Missing authorization code' },
      headersWithRateLimit
    );
  }

  try {
    // Exchange code for token with GitHub
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json() as TokenResponse | { error: string; error_description?: string };

    // Check for error in GitHub response
    if ('error' in tokenData) {
      console.error('GitHub token exchange error:', tokenData);
      return jsonResponse(
        400,
        {
          error: tokenData.error,
          error_description: tokenData.error_description || 'Token exchange failed',
        },
        headersWithRateLimit
      );
    }

    // Success - return the token
    return jsonResponse(200, tokenData, headersWithRateLimit);
  } catch (error) {
    console.error('Token exchange error:', error);
    return jsonResponse(
      500,
      { error: 'server_error', error_description: 'Failed to exchange token' },
      headersWithRateLimit
    );
  }
};

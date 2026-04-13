/**
 * Cloudflare Access JWT Authentication
 *
 * Validates JWT tokens from Cloudflare Access using the jose library
 * Based on: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface CloudflareIdentity {
  email: string;
  id: string;
  name?: string;
  groups?: string[];
}

// Default JWKS endpoint for your Cloudflare Access team
const DEFAULT_JWKS_URL = 'https://cf-jsherron-test-account.cloudflareaccess.com/cdn-cgi/access/certs';

// Default AUD (Application Audience) tag
const DEFAULT_AUD = '702cc4393c7a66d7e67afbc54d187f73af21aa449639707f6389d0ee93a856da';

/**
 * Verify Cloudflare Access JWT from request headers
 * Uses the jose library to validate the JWT signature against Cloudflare's JWKS
 */
export async function verifyCloudflareAccess(
  request: Request,
  teamDomain: string = 'https://cf-jsherron-test-account.cloudflareaccess.com',
  policyAud: string = DEFAULT_AUD
): Promise<CloudflareIdentity | null> {
  // Get the JWT from the request headers
  const token = request.headers.get('cf-access-jwt-assertion');

  if (!token) {
    return null;
  }

  try {
    // Create JWKS from your team domain
    const JWKS = createRemoteJWKSet(
      new URL(`${teamDomain}/cdn-cgi/access/certs`)
    );

    // Verify the JWT
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: teamDomain,
      audience: policyAud,
    });

    // Extract identity from payload
    return {
      email: payload.email as string,
      id: payload.sub as string,
      name: payload.name as string | undefined,
      groups: payload.groups as string[] | undefined,
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Check if authentication is required for this request
 */
export function isAuthRequired(pathname: string): boolean {
  // Public endpoints that don't require auth
  const publicPaths = [
    '/health',
    '/api/health',
    '/favicon.ico',
  ];

  return !publicPaths.includes(pathname);
}

/**
 * Main authentication handler for Cloudflare Access
 * 
 * Auth can be toggled on/off via REQUIRE_AUTH environment variable:
 * - REQUIRE_AUTH = "true"  → Auth enabled (users must authenticate via Cloudflare Access)
 * - REQUIRE_AUTH = "false" → Auth disabled (public access allowed)
 * 
 * Can be set in:
 * 1. wrangler.toml [vars] section
 * 2. GitHub Actions environment variables
 * 3. Cloudflare Dashboard → Worker Settings → Environment Variables
 */
export async function handleCloudflareAccess(
  request: Request,
  env: {
    REQUIRE_AUTH?: string;  // Toggle: "true" = enabled, "false" = disabled
    TEAM_DOMAIN?: string;   // Optional: override team domain
    POLICY_AUD?: string;    // Optional: override AUD tag
  }
): Promise<{ identity: CloudflareIdentity | null; response: Response | null }> {
  const url = new URL(request.url);

  // Skip auth for public paths
  if (!isAuthRequired(url.pathname)) {
    return { identity: null, response: null };
  }

  // Check if auth is enabled - default to disabled for safety
  const authEnabled = env.REQUIRE_AUTH === 'true';
  if (!authEnabled) {
    // Auth is disabled - allow all requests
    return { identity: null, response: null };
  }

  // Verify the Cloudflare Access JWT
  const teamDomain = env.TEAM_DOMAIN || 'https://cf-jsherron-test-account.cloudflareaccess.com';
  const policyAud = env.POLICY_AUD || DEFAULT_AUD;

  const identity = await verifyCloudflareAccess(request, teamDomain, policyAud);

  if (!identity) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    const response = new Response(
      JSON.stringify(
        {
          error: 'Unauthorized',
          message: 'Authentication required. Please access this application through Cloudflare Access.',
          login_url: `${teamDomain}/cdn-cgi/access/login`,
        },
        null,
        2
      ),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

    return { identity: null, response };
  }

  return { identity, response: null };
}

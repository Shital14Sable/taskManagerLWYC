/**
 * Google OAuth authentication handling
 *
 * The OAuth flow works as follows:
 * 1. User clicks "Sign in with Google"
 * 2. We redirect to Google's OAuth authorize URL
 * 3. User authorizes the app with drive.file scope
 * 4. Google redirects back with a code
 * 5. We exchange the code for an access token via our serverless function
 * 6. Token is stored locally and used for API calls
 */

export interface GoogleOAuthConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  tokenExchangeUrl: string;
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: GoogleUser | null;
  expiresAt: Date | null;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

const STORAGE_KEY = 'trackmind_google_auth';
// drive.file scope only allows access to files created by this app
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

/**
 * Generates a random state string for OAuth CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate PKCE code verifier and challenge for enhanced security
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  // Generate challenge from verifier
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { verifier, challenge };
}

/**
 * Google OAuth authentication manager
 */
export class GoogleAuth {
  private config: GoogleOAuthConfig;
  private state: GoogleAuthState;

  constructor(config: GoogleOAuthConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? DEFAULT_SCOPE,
    };
    this.state = this.loadState();
  }

  /**
   * Get current authentication state
   */
  getAuthState(): GoogleAuthState {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.state.isAuthenticated || !this.state.accessToken) {
      return false;
    }

    // Check if token has expired (with 5 min buffer)
    if (this.state.expiresAt) {
      const bufferMs = 5 * 60 * 1000;
      if (new Date().getTime() > this.state.expiresAt.getTime() - bufferMs) {
        // Token expired or about to expire
        // If we have refresh token, we can refresh later
        if (!this.state.refreshToken) {
          this.logout();
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if token needs refresh
   */
  needsRefresh(): boolean {
    if (!this.state.expiresAt || !this.state.refreshToken) {
      return false;
    }
    const bufferMs = 5 * 60 * 1000;
    return new Date().getTime() > this.state.expiresAt.getTime() - bufferMs;
  }

  /**
   * Get access token for API calls
   */
  getToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.state.accessToken;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.state.refreshToken;
  }

  /**
   * Start OAuth flow by redirecting to Google
   */
  async startOAuthFlow(): Promise<void> {
    const state = generateState();
    const pkce = await generatePKCE();

    // Store state and PKCE verifier for verification
    sessionStorage.setItem('google_oauth_state', state);
    sessionStorage.setItem('google_oauth_verifier', pkce.verifier);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope!,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Always show consent to get refresh token
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback
   * Call this when the user is redirected back from Google
   */
  async handleCallback(code: string, state: string): Promise<boolean> {
    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('google_oauth_state');
    if (!storedState || storedState !== state) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }

    // Get PKCE verifier
    const verifier = sessionStorage.getItem('google_oauth_verifier');
    if (!verifier) {
      throw new Error('Missing PKCE verifier');
    }

    // Clean up session storage
    sessionStorage.removeItem('google_oauth_state');
    sessionStorage.removeItem('google_oauth_verifier');

    // Exchange code for token via serverless function
    const tokenResponse = await this.exchangeCodeForToken(code, verifier);

    // Calculate expiration
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Fetch user info
    const user = await this.fetchUserInfo(tokenResponse.access_token);

    // Update state
    this.state = {
      isAuthenticated: true,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || this.state.refreshToken,
      user,
      expiresAt,
    };

    this.saveState();
    return true;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.state.refreshToken;
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(this.config.tokenExchangeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenResponse: GoogleTokenResponse = await response.json();
      const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

      this.state = {
        ...this.state,
        accessToken: tokenResponse.access_token,
        expiresAt,
        // Refresh token might be returned in some cases
        refreshToken: tokenResponse.refresh_token || this.state.refreshToken,
      };

      this.saveState();
      return true;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string, verifier: string): Promise<GoogleTokenResponse> {
    const response = await fetch(this.config.tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: verifier,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch user info from Google API
   */
  private async fetchUserInfo(token: string): Promise<GoogleUser> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatarUrl: data.picture,
    };
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    this.state = {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      expiresAt: null,
    };
    this.saveState();
  }

  /**
   * Load authentication state from storage
   */
  private loadState(): GoogleAuthState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return this.getDefaultState();
      }

      const parsed = JSON.parse(stored);
      return {
        isAuthenticated: parsed.isAuthenticated ?? false,
        accessToken: parsed.accessToken ?? null,
        refreshToken: parsed.refreshToken ?? null,
        user: parsed.user ?? null,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
      };
    } catch {
      return this.getDefaultState();
    }
  }

  /**
   * Save authentication state to storage
   */
  private saveState(): void {
    const toStore = {
      isAuthenticated: this.state.isAuthenticated,
      accessToken: this.state.accessToken,
      refreshToken: this.state.refreshToken,
      user: this.state.user,
      expiresAt: this.state.expiresAt?.toISOString() ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }

  /**
   * Get default unauthenticated state
   */
  private getDefaultState(): GoogleAuthState {
    return {
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      expiresAt: null,
    };
  }

  /**
   * Create a configured GoogleAuth instance from environment
   */
  static createFromEnv(): GoogleAuth {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI ?? `${window.location.origin}/`;
    const tokenExchangeUrl = import.meta.env.VITE_GOOGLE_TOKEN_EXCHANGE_URL ?? '/.netlify/functions/google-oauth';

    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
    }

    return new GoogleAuth({
      clientId,
      redirectUri,
      tokenExchangeUrl,
    });
  }
}

/**
 * Parse Google OAuth callback URL parameters
 */
export function parseGoogleCallbackParams(url: string): { code: string; state: string } | null {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');

  // Check if this looks like a Google callback (has scope parameter too)
  const scope = urlObj.searchParams.get('scope');
  const isGoogleCallback = scope?.includes('googleapis.com') || sessionStorage.getItem('google_oauth_state') !== null;

  if (!code || !state || !isGoogleCallback) {
    return null;
  }

  return { code, state };
}

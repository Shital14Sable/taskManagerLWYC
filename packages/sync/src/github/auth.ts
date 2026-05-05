/**
 * GitHub OAuth authentication handling
 *
 * The OAuth flow works as follows:
 * 1. User clicks "Connect to GitHub"
 * 2. We redirect to GitHub's OAuth authorize URL
 * 3. User authorizes the app
 * 4. GitHub redirects back with a code
 * 5. We exchange the code for an access token via our serverless function
 * 6. Token is stored locally and used for API calls
 */

export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
  tokenExchangeUrl: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: GitHubUser | null;
  expiresAt: Date | null;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  email: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

const STORAGE_KEY = 'trackmind_github_auth';
const DEFAULT_SCOPE = 'repo';

/**
 * Generates a random state string for OAuth CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * GitHub OAuth authentication manager
 */
export class GitHubAuth {
  private config: OAuthConfig;
  private state: AuthState;
  private stateStorage: Map<string, number> = new Map();

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
      scope: config.scope ?? DEFAULT_SCOPE,
    };
    this.state = this.loadState();
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.state };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.state.isAuthenticated || !this.state.token) {
      return false;
    }

    // Check if token has expired
    if (this.state.expiresAt && new Date() > this.state.expiresAt) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Get access token for API calls
   */
  getToken(): string | null {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.state.token;
  }

  /**
   * Start OAuth flow by redirecting to GitHub
   */
  startOAuthFlow(): void {
    const state = generateState();

    // Store state with timestamp for verification (expires in 10 minutes)
    this.stateStorage.set(state, Date.now());
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope!,
      state,
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
    window.location.href = authUrl;
  }

  /**
   * Handle OAuth callback
   * Call this when the user is redirected back from GitHub
   */
  async handleCallback(code: string, state: string): Promise<boolean> {
    // Verify state to prevent CSRF
    const storedState = sessionStorage.getItem('oauth_state');
    if (!storedState || storedState !== state) {
      throw new Error('Invalid OAuth state - possible CSRF attack');
    }
    sessionStorage.removeItem('oauth_state');

    // Exchange code for token via serverless function
    const tokenResponse = await this.exchangeCodeForToken(code);

    // Calculate expiration if provided
    let expiresAt: Date | null = null;
    if (tokenResponse.expires_in) {
      expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    }

    // Fetch user info
    const user = await this.fetchUserInfo(tokenResponse.access_token);

    // Update state
    this.state = {
      isAuthenticated: true,
      token: tokenResponse.access_token,
      user,
      expiresAt,
    };

    this.saveState();
    return true;
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Fetch user info from GitHub API
   */
  private async fetchUserInfo(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    const data = await response.json();
    return {
      login: data.login,
      name: data.name,
      avatarUrl: data.avatar_url,
      email: data.email,
    };
  }

  /**
   * Logout and clear stored credentials
   */
  logout(): void {
    this.state = {
      isAuthenticated: false,
      token: null,
      user: null,
      expiresAt: null,
    };
    this.saveState();
  }

  /**
   * Load authentication state from storage
   */
  private loadState(): AuthState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return this.getDefaultState();
      }

      const parsed = JSON.parse(stored);
      return {
        isAuthenticated: parsed.isAuthenticated ?? false,
        token: parsed.token ?? null,
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
      token: this.state.token,
      user: this.state.user,
      expiresAt: this.state.expiresAt?.toISOString() ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  }

  /**
   * Get default unauthenticated state
   */
  private getDefaultState(): AuthState {
    return {
      isAuthenticated: false,
      token: null,
      user: null,
      expiresAt: null,
    };
  }

  /**
   * Create a configured GitHubAuth instance from environment
   */
  static createFromEnv(): GitHubAuth {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
    const tokenExchangeUrl = import.meta.env.VITE_TOKEN_EXCHANGE_URL ?? '/.netlify/functions/oauth';

    if (!clientId) {
      throw new Error('VITE_GITHUB_CLIENT_ID is not configured');
    }

    return new GitHubAuth({
      clientId,
      redirectUri,
      tokenExchangeUrl,
    });
  }
}

/**
 * Parse OAuth callback URL parameters
 */
export function parseCallbackParams(url: string): { code: string; state: string } | null {
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');

  if (!code || !state) {
    return null;
  }

  return { code, state };
}

/**
 * Check if current URL is an OAuth callback
 */
export function isOAuthCallback(url: string): boolean {
  return parseCallbackParams(url) !== null;
}

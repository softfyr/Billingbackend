/**
 * In-Memory Token Blacklist Store (Server-Side Token Revocation)
 * Keeps track of logged-out access and refresh tokens.
 */
class TokenBlacklistService {
  constructor() {
    this.blacklistedTokens = new Set();
  }

  /**
   * Add token to blacklist upon logout
   */
  revokeToken(token) {
    if (token && typeof token === 'string') {
      const cleanToken = token.replace('Bearer ', '').trim();
      this.blacklistedTokens.add(cleanToken);
    }
  }

  /**
   * Check if a token has been revoked/logged out
   */
  isRevoked(token) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.replace('Bearer ', '').trim();
    return this.blacklistedTokens.has(cleanToken);
  }

  /**
   * Clear old tokens periodically (memory management)
   */
  clearAll() {
    this.blacklistedTokens.clear();
  }
}

export const tokenBlacklist = new TokenBlacklistService();

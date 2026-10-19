/**
 * Sample TypeScript module used by tests.
 */

// Token lifetime in seconds.
export const TOKEN_TTL_SECONDS = 3600;

export interface Token {
  user: string;
  expiresAt: number;
}

export function createToken(user: string): Token {
  // absolute expiry timestamp
  return { user, expiresAt: Date.now() / 1000 + TOKEN_TTL_SECONDS };
}

export function isExpired(token: Token): boolean {
  return Date.now() / 1000 > token.expiresAt;
}

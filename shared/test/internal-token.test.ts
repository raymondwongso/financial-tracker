import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signInternalToken, verifyInternalToken } from '../src/server';

const secret = 'a-test-secret-that-is-at-least-32-characters';
const userId = '3f1b1c5e-8d7a-4f3e-9a51-2b7c6d8e9f01';

describe('internal token', () => {
  it('round-trips the user id', async () => {
    const token = await signInternalToken(secret, userId);
    await expect(verifyInternalToken(secret, token)).resolves.toBe(userId);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signInternalToken('another-secret-that-is-at-least-32-chars', userId);
    await expect(verifyInternalToken(secret, token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('ft-api')
      .setAudience('ft-mcp')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(secret));
    await expect(verifyInternalToken(secret, token)).rejects.toThrow();
  });

  it('rejects a token for another audience', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer('ft-api')
      .setAudience('someone-else')
      .setExpirationTime('1m')
      .sign(new TextEncoder().encode(secret));
    await expect(verifyInternalToken(secret, token)).rejects.toThrow();
  });
});

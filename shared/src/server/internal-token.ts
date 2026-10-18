import { SignJWT, jwtVerify } from 'jose';

// Short-lived token the API sends to the MCP server so tools act on behalf of the logged-in user.
const ISSUER = 'ft-api';
const AUDIENCE = 'ft-mcp';

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signInternalToken(
  secret: string,
  userId: string,
  ttlSeconds = 300,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key(secret));
}

/** Returns the user id, or throws if the token is missing, expired, forged or for another audience. */
export async function verifyInternalToken(secret: string, token: string): Promise<string> {
  const { payload } = await jwtVerify(token, key(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return payload.sub;
}

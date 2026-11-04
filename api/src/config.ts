export interface Config {
  port: number;
  logLevel: string;
  databaseUrl: string;
  version: string;
  jwtSecret: string;
  corsOrigin: string;
  cookieSecure: boolean;
  trustProxy: boolean;
}

const DEV_JWT_SECRET = "dev-only-secret-change-me";
const MIN_JWT_SECRET_LENGTH = 32;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === "production";
  if (production && (env.JWT_SECRET ?? "").length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be set to at least ${MIN_JWT_SECRET_LENGTH} characters in production`);
  }
  return {
    port: Number(env.PORT ?? 3000),
    logLevel: env.LOG_LEVEL ?? "info",
    databaseUrl:
      env.DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/financial_tracker",
    version: "1.0.0",
    jwtSecret: env.JWT_SECRET ?? DEV_JWT_SECRET,
    corsOrigin: env.CORS_ORIGIN ?? "http://localhost:3001",
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : production,
    trustProxy: env.TRUST_PROXY === "true",
  };
}

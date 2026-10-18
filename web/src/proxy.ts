import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'ft_session';

/** Sends visitors without a session to /login. The API still verifies the session on every call. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL('/login', request.url);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except auth pages, the API proxy, Next internals and observability endpoints.
  matcher: ['/((?!login|register|api|_next|health|metrics|vitals|favicon.ico).*)'],
};

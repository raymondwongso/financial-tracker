import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, parseResponse } from './api-error';
import { logger } from './logger';

import { config } from '@/config';

const API_URL = config.apiUrl;

/**
 * Server-side API client for server components: forwards the session cookie and sends the user
 * to /login when the session is missing or expired.
 */
export async function serverApi<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  try {
    return await parseResponse<T>(res);
  } catch (error) {
    if (error instanceof ApiError)
      logger.error({ path, status: error.status }, 'api request failed');
    throw error;
  }
}

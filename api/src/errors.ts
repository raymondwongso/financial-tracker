export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, 'NotFound', `${what} not found`);
export const unauthorized = (message = 'Authentication required') =>
  new HttpError(401, 'Unauthorized', message);

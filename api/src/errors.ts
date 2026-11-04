export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export const badRequest = (m: string) => new AppError(400, m);
export const unauthorized = (m = "Unauthorized") => new AppError(401, m);
export const notFound = (m = "not found") => new AppError(404, m);
export const conflict = (m: string) => new AppError(409, m);

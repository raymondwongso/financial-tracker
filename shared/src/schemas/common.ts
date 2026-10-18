import { z } from 'zod';

export const idSchema = z.uuid();

/** Calendar month in `YYYY-MM` form, e.g. `2026-10`. */
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected a month in YYYY-MM format');

/** Calendar date in `YYYY-MM-DD` form. */
export const dateSchema = z.iso.date();

/** ISO 4217 currency code, normalised to upper case. */
export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Expected a 3-letter currency code');

/** Amount in minor units (e.g. cents). Always positive; the transaction type carries the sign. */
export const amountMinorSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const idParamsSchema = z.object({ id: idSchema });

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type Month = z.infer<typeof monthSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export interface TransactionCursor {
  createdAt: string;
  id: number;
}

export function encodeCursor(c: TransactionCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string): TransactionCursor | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof v !== "object" || v === null) return null;
    const { createdAt, id } = v as Record<string, unknown>;
    if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) return null;
    if (typeof id !== "number" || !Number.isInteger(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

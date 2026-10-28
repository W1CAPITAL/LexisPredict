import { createHash } from "node:crypto";

/** Fingerprint apenas dos metadados de cada usuário; detecta inserção, edição,
 * leitura e exclusão, sem expor outros tenants nem depender do relógio do cliente.
 */
export type NotificationVersionRow = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
  read_at?: string | null;
  lida?: boolean | null;
};

export function notificationVersion(rows: readonly NotificationVersionRow[]): string {
  const reduced = rows.map((row) => [
    row.id, row.created_at ?? null, row.updated_at ?? null,
    row.read_at ?? null, !!row.lida,
  ]);
  return createHash("sha256").update(JSON.stringify(reduced)).digest("hex");
}

export function validNotificationCursor(cursor: string | null): string | null {
  return cursor && /^[0-9a-f]{64}$/.test(cursor) ? cursor : null;
}

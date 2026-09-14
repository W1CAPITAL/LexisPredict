export function caseIdentity(c: any): string {
  const raw = String(c?.protocolo ?? c?.protocolo_ref ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 20) return `cnj:${digits}`;
  // Administrative placeholders are not identifiers shared by every case.
  if (c?.db_id || c?.id) return `id:${c.db_id || c.id}`;
  return raw ? `ref:${raw}` : '';
}

export function uniqueCases<T>(cases: T[]): T[] {
  const map = new Map<string, T>();
  for (const c of cases || []) {
    if (!c) continue;
    const key = caseIdentity(c);
    if (!key) continue;
    const prev = map.get(key) as any;
    const item = c as any;
    const stamp = (x: any) => Date.parse(x?.updated_at || x?.edited_at || x?.atendido_em || x?.dados?.edited_at || '') || 0;
    if (!prev || stamp(item) > stamp(prev) || (stamp(item) === stamp(prev) && String(item.id || '') > String(prev.id || ''))) map.set(key, c);
  }
  return [...map.values()];
}

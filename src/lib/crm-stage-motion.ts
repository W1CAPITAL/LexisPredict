/**
 * Find only real CRM stage transitions reflected by the current backend data.
 * Initial fetches, inserted cards, deletions and same-stage reorders never
 * trigger a "moved" animation or announce a successful update.
 */
type StageableDeal = { id: string };
export function indexCrmStages(byStatus: Record<string, readonly StageableDeal[]>) {
  const snapshot = new Map<string, string>();
  for (const [stage, deals] of Object.entries(byStatus)) {
    for (const deal of deals || []) snapshot.set(deal.id, stage);
  }
  return snapshot;
}

export function findConfirmedCrmMoves(
  previous: ReadonlyMap<string, string> | null,
  next: ReadonlyMap<string, string>,
) {
  if (!previous) return [];
  const moved: string[] = [];
  for (const [id, stage] of next) {
    if (previous.has(id) && previous.get(id) !== stage) moved.push(id);
  }
  return moved;
}

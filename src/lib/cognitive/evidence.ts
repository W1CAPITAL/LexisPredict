export type EvidenceKind = 'supports' | 'contradicts' | 'context';

export type EvidenceItem = {
  id: string;
  claim: string;
  source: string;
  excerpt?: string;
  kind: EvidenceKind;
  reliability?: number;
  observedAt?: string;
};

export type EvidenceAssessment = {
  support: number;
  contradiction: number;
  balance: number;
  sources: string[];
  hasConflict: boolean;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function assessEvidence(items: EvidenceItem[]): EvidenceAssessment {
  let support = 0;
  let contradiction = 0;
  const sources = new Set<string>();

  for (const item of items) {
    const weight = clamp(item.reliability ?? 0.6);
    if (item.source) sources.add(item.source);
    if (item.kind === 'supports') support += weight;
    if (item.kind === 'contradicts') contradiction += weight;
  }

  const total = support + contradiction;
  return {
    support,
    contradiction,
    balance: total ? (support - contradiction) / total : 0,
    sources: [...sources],
    hasConflict: support > 0 && contradiction > 0,
  };
}

export function evidencePromptBlock(items: EvidenceItem[], maxChars = 12000): string {
  const ordered = [...items].sort((a, b) => (b.reliability ?? 0.6) - (a.reliability ?? 0.6));
  const lines: string[] = [];
  let used = 0;

  for (const item of ordered) {
    const line = [
      `[${item.kind.toUpperCase()}] ${item.claim}`,
      `Fonte: ${item.source}`,
      item.observedAt ? `Data: ${item.observedAt}` : '',
      item.excerpt ? `Trecho: ${item.excerpt}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }

  return lines.join('\n');
}

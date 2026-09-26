export type ChangeSnapshot = {
  fingerprint: string;
  text: string;
  capturedAt: string;
};

export type ChangeDiff = {
  changed: boolean;
  previousFingerprint?: string;
  currentFingerprint: string;
  added: string[];
  removed: string[];
};

function normalizeSnapshotText(value: string): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** FNV-1a 32-bit: barato, determinístico e suficiente para detectar mudança. */
export function fingerprintText(value: string): string {
  const text = normalizeSnapshotText(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSnapshot(text: string, capturedAt = new Date().toISOString()): ChangeSnapshot {
  const normalized = normalizeSnapshotText(text);
  return {
    fingerprint: fingerprintText(normalized),
    text: normalized,
    capturedAt,
  };
}

export function diffSnapshots(previous: ChangeSnapshot | null, current: ChangeSnapshot): ChangeDiff {
  if (!previous) {
    return {
      changed: true,
      currentFingerprint: current.fingerprint,
      added: current.text ? current.text.split('\n').slice(0, 200) : [],
      removed: [],
    };
  }

  if (previous.fingerprint === current.fingerprint) {
    return {
      changed: false,
      previousFingerprint: previous.fingerprint,
      currentFingerprint: current.fingerprint,
      added: [],
      removed: [],
    };
  }

  const oldLines = new Set(previous.text.split('\n').filter(Boolean));
  const newLines = new Set(current.text.split('\n').filter(Boolean));

  return {
    changed: true,
    previousFingerprint: previous.fingerprint,
    currentFingerprint: current.fingerprint,
    added: [...newLines].filter((line) => !oldLines.has(line)).slice(0, 200),
    removed: [...oldLines].filter((line) => !newLines.has(line)).slice(0, 200),
  };
}

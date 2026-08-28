/**
 * @fileOverview Motor de Normalização Cronológica v100.0
 * Garante a integridade entre formatos DD/MM/YYYY e ISO.
 */
export function parseBrazilianDate(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v === '-' || v === '—' || v === '00/00/0000' || v === '0' || v.toUpperCase() === 'NULL') return null;
  if (v.includes('#')) return null;
  // Serial Excel (número puro)
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const n = Math.floor(Number(v));
    if (n >= 20000 && n <= 80000) {
      const utc = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(utc);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      if (y >= 1950 && y <= 2110) return `${y}-${m}-${day}`;
    }
  }
  // Se já for formato ISO (AAAA-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Detectar formato brasileiro (DD/MM/AAAA ou DD-MM-AAAA)
  const m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = d.padStart(2, '0');
  const month = mo.padStart(2, '0');
  const iso = `${y}-${month}-${day}`;
  // Validação de segurança Next.js 15
  const dt = new Date(iso + 'T12:00:00');
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() < 1900 || dt.getFullYear() > 2100) return null;
  return iso;
}
export function formatDateBR(iso?: string | null): string {
  if (!iso) return '';
  const parts = iso.split('T')[0].split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

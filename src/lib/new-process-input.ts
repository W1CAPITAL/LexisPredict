/**
 * Formats a Brazilian CNJ number for a new process record.
 * Returns null unless the input contains exactly the 20 digits required by the
 * national process-number standard.
 */
export function formatNewProcessCnj(value: string): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 20) return null;

  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

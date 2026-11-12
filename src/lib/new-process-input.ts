/**
 * Formats and validates a Brazilian CNJ process number.
 * Requires the 20 digits and the national modulo-97 check digits.
 */
export function formatNewProcessCnj(value: string): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 20) return null;

  // CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO; DD = 98 - (base + "00" mod 97).
  const base = `${digits.slice(0, 7)}${digits.slice(9, 13)}${digits.slice(13, 14)}${digits.slice(14, 16)}${digits.slice(16, 20)}00`;
  const remainder = Array.from(base).reduce(
    (current, digit) => (current * 10 + Number(digit)) % 97,
    0,
  );
  const expectedCheckDigits = String(98 - remainder).padStart(2, "0");
  if (digits.slice(7, 9) !== expectedCheckDigits) return null;

  return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
}

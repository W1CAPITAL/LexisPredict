/** TS 7: Uint8Array.buffer pode ser SharedArrayBuffer — Blob exige ArrayBuffer. */
export function u8ToBlob(u8: Uint8Array, type: string): Blob {
  const copy = new ArrayBuffer(u8.byteLength);
  new Uint8Array(copy).set(u8);
  return new Blob([copy], { type });
}

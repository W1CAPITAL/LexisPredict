/** Download base64 no browser */
export function downloadBase64File(base64: string, filename: string, mime: string) {
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${base64}`;
  a.download = filename;
  a.click();
}

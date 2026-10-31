'use client';

/** Download an authenticated server export without loading the PDF engine in the browser. */
export async function downloadServerReport(path: string, fallback: string): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/pdf, application/json' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || 'Não foi possível gerar o relatório.');
  }
  const blob = await response.blob();
  if (blob.size < 100) throw new Error('O servidor retornou um PDF vazio.');
  const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/i)?.[1] || fallback;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl; link.download = filename; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

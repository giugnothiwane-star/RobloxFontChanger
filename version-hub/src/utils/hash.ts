/** Sérialisation canonique identique à scripts/sync-engines.mjs (clés triées). */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle?.digest === 'function';
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  if (!hasSubtleCrypto()) throw new Error('WebCrypto indisponible (contexte non sécurisé ?).');
  const bytes: Uint8Array<ArrayBuffer> = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const out = new Array<string>(digest.byteLength);
  const view = new Uint8Array(digest);
  for (let i = 0; i < view.length; i++) out[i] = (view[i] ?? 0).toString(16).padStart(2, '0');
  return out.join('');
}

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
const hashes = new WeakMap<Blob, Promise<string>>();
export const hashBlob = (blob: Blob): Promise<string> => {
  const existing = hashes.get(blob);
  if (existing) return existing;
  const hash = (async () => {
    const digest = sha256.create();
    for (let offset = 0; offset < blob.size; offset += 256 * 1024) {
      digest.update(
        new Uint8Array(
          await blob.slice(offset, offset + 256 * 1024).arrayBuffer()
        )
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return bytesToHex(digest.digest());
  })();
  hashes.set(blob, hash);
  void hash.catch(() => hashes.delete(blob));
  return hash;
};
export const hashBase64 = (base64: string) => {
  const bytes = Uint8Array.from(atob(base64), (character) =>
    character.charCodeAt(0)
  );
  return { hash: bytesToHex(sha256(bytes)), size: bytes.length };
};
export async function hashResponse(
  response: Response,
  expectedSize: number,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
) {
  if (!response.ok)
    throw new Error(`Resource verification failed (${response.status}).`);
  const digest = sha256.create();
  let count = 0;
  if (!response.body) {
    if (expectedSize > 4 * 1024 * 1024)
      throw new Error('This browser cannot verify a large audio stream.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    digest.update(bytes);
    count = bytes.length;
  } else {
    const reader = response.body.getReader();
    const abort = () => {
      void reader.cancel().catch(() => {});
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const chunk = await reader.read();
        if (chunk.done) break;
        count += chunk.value.length;
        if (count > expectedSize)
          throw new Error(
            'The published resource does not match the saved file.'
          );
        digest.update(chunk.value);
        onProgress?.(
          expectedSize ? Math.min(100, (count / expectedSize) * 100) : 100
        );
      }
    } finally {
      signal?.removeEventListener('abort', abort);
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (count !== expectedSize)
    throw new Error('The published file size does not match the saved file.');
  return bytesToHex(digest.digest());
}

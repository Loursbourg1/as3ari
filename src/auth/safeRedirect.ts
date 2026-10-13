/**
 * Validate a post-login return path. Only same-origin, absolute paths are allowed;
 * anything else (external URLs, protocol-relative "//", backslashes, javascript:)
 * falls back to the default. Prevents open-redirect abuse of ?next=.
 */
function isSafePath(candidate: string): boolean {
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return false;
  for (const ch of candidate) {
    const code = ch.charCodeAt(0);
    if (ch === '\\' || code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

export function safeRedirectPath(next: string | null | undefined, fallback = '/'): string {
  if (!next || typeof next !== 'string' || next.length > 512) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (!isSafePath(next) || !isSafePath(decoded)) return fallback;
  try {
    const url = new URL(next, 'https://as3ari.invalid');
    if (url.origin !== 'https://as3ari.invalid') return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

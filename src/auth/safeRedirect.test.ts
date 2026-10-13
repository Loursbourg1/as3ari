import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safeRedirect';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths with query strings', () => {
    expect(safeRedirectPath('/contribute?product=eggs')).toBe('/contribute?product=eggs');
    expect(safeRedirectPath('/me')).toBe('/me');
  });
  it.each([
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '%2F%2Fevil.example',
    'javascript:alert(1)',
    'contribute',
    '/foo\nbar',
    '',
    null,
    undefined,
  ])('rejects %s', (bad) => {
    expect(safeRedirectPath(bad as string)).toBe('/');
  });
});

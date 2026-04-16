import { describe, expect, it } from 'vitest';
import { getKeyFromUrl } from '../../src/config/storage.js';

describe('getKeyFromUrl', () => {
  it('returns the path (without leading slash) for a virtual-hosted Spaces URL', () => {
    expect(
      getKeyFromUrl('https://mybucket.nyc3.digitaloceanspaces.com/avatars/abc.png'),
    ).toBe('avatars/abc.png');
  });

  it('returns the full pathname for deeply nested keys', () => {
    expect(
      getKeyFromUrl('https://b.cdn.digitaloceanspaces.com/post_images/2024/01/xyz.jpg'),
    ).toBe('post_images/2024/01/xyz.jpg');
  });

  it('strips only the first leading slash', () => {
    expect(
      getKeyFromUrl('https://example.com//double-slash-key'),
    ).toBe('/double-slash-key');
  });

  it('returns null for an empty path (root URL)', () => {
    expect(getKeyFromUrl('https://mybucket.example.com/')).toBeNull();
  });

  it('returns null for an unparseable URL', () => {
    expect(getKeyFromUrl('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getKeyFromUrl('')).toBeNull();
  });

  it('ignores query strings and fragments', () => {
    expect(
      getKeyFromUrl('https://b.example.com/avatars/x.png?sig=abc#frag'),
    ).toBe('avatars/x.png');
  });
});

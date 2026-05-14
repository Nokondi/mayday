import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from '../../src/i18n/config.js';

describe('i18n config', () => {
  it('includes the default locale in the supported list', () => {
    expect(SUPPORTED_LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('recognizes supported locale codes', () => {
    expect(isSupportedLocale('en')).toBe(true);
  });

  it('rejects unsupported locale codes', () => {
    expect(isSupportedLocale('xx')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});

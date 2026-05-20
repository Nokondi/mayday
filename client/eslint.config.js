import jsxA11y from 'eslint-plugin-jsx-a11y';
import formatjs from 'eslint-plugin-formatjs';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'tests/**'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      formatjs,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: { ...globals.browser },
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // Ratchets the i18n migration in place: literal strings in JSX text or in
      // label/placeholder/title/alt/aria-* props must go through
      // <FormattedMessage> / intl.formatMessage(). Symbols and brand names
      // (›, ―, "MayDay", "404") are kept as module-scope consts or use inline
      // eslint-disable comments at the call site so each exception is
      // documented.
      'formatjs/no-literal-string-in-jsx': 'error',
    },
  },
  {
    // i18n source/output files are exempt — they contain English strings by design.
    files: ['src/i18n/**'],
    rules: {
      'formatjs/no-literal-string-in-jsx': 'off',
    },
  },
);

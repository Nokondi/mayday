import { render, type RenderOptions } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { type ReactElement, type ReactNode } from 'react';
import { DEFAULT_LOCALE } from '../../src/i18n/config.js';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  locale?: string;
  messages?: Record<string, string>;
}

export function renderWithIntl(ui: ReactElement, options: Options = {}) {
  const { locale = DEFAULT_LOCALE, messages = {}, ...rest } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <IntlProvider
        locale={locale}
        defaultLocale={DEFAULT_LOCALE}
        messages={messages}
      >
        {children}
      </IntlProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

import { type ReactNode } from 'react';
import { IntlProvider } from 'react-intl';
import { DEFAULT_LOCALE } from './config.js';
import enMessages from './compiled/en.json';

const messagesByLocale: Record<string, Record<string, unknown>> = {
  en: enMessages,
};

interface Props {
  children: ReactNode;
  locale?: string;
}

export function IntlProviderWrapper({ children, locale = DEFAULT_LOCALE }: Props) {
  const messages = messagesByLocale[locale] ?? messagesByLocale[DEFAULT_LOCALE];

  return (
    <IntlProvider
      locale={locale}
      defaultLocale={DEFAULT_LOCALE}
      messages={messages as Record<string, string>}
    >
      {children}
    </IntlProvider>
  );
}

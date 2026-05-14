import { render, screen } from '@testing-library/react';
import { FormattedMessage } from 'react-intl';
import { IntlProviderWrapper } from '../../src/i18n/IntlProviderWrapper.js';

describe('IntlProviderWrapper', () => {
  it('renders children inside an IntlProvider so FormattedMessage works', () => {
    render(
      <IntlProviderWrapper>
        <FormattedMessage defaultMessage="Hello world" />
      </IntlProviderWrapper>,
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('falls back to default locale when given an unsupported locale', () => {
    render(
      <IntlProviderWrapper locale="xx-XX">
        <FormattedMessage defaultMessage="Fallback works" />
      </IntlProviderWrapper>,
    );
    expect(screen.getByText('Fallback works')).toBeInTheDocument();
  });
});

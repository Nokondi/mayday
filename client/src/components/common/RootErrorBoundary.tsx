/* eslint-disable formatjs/no-literal-string-in-jsx --
   This is the last-resort crash screen. It sits OUTSIDE IntlProvider so it can
   still render when a provider (including i18n) is what threw, which means
   <FormattedMessage> is not available here. The few strings below are
   deliberately hard-coded; per the project convention each exception is
   documented at the call site. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientError } from '../../utils/diagnostics.js';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Catches any render-time throw in the React tree. Without this, React 18
// unmounts the entire app on an uncaught error, leaving a blank screen with no
// way to recover except a manual reload — the exact failure we're guarding
// against. Here we show a Reload button and beacon the error for diagnostics.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError({
      kind: 'react-error-boundary',
      detail: `${error.message}\n${info.componentStack ?? ''}`,
    });
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('mayday-boot-retried');
    } catch {
      /* ignore */
    }
    location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '0 1.5rem',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#2c6f93',
          }}
        >
          <p>Something went wrong loading MayDay.</p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              font: 'inherit',
              color: '#fff',
              background: '#3fa7de',
              border: 0,
              borderRadius: '0.5rem',
              padding: '0.6rem 1.25rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

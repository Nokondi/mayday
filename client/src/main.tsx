import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext.js';
import { DeviceProvider } from './context/DeviceContext.js';
import { IntlProviderWrapper } from './i18n/IntlProviderWrapper.js';
import { RootErrorBoundary } from './components/common/RootErrorBoundary.js';
import { installDiagnostics } from './utils/diagnostics.js';
import { App } from './App.js';
import './styles/index.css';

declare global {
  interface Window {
    // Defined by the boot watchdog in index.html; called here to cancel it
    // once React has successfully mounted.
    __maydayBooted__?: () => void;
  }
}

installDiagnostics();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

// RootErrorBoundary is the outermost wrapper so it can catch a throw from any
// provider — including IntlProvider itself — and still render a usable crash
// screen instead of a blank page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <IntlProviderWrapper>
          <BrowserRouter>
            <AuthProvider>
              <DeviceProvider>
                <App />
                <Toaster position="bottom-right" richColors />
              </DeviceProvider>
            </AuthProvider>
          </BrowserRouter>
        </IntlProviderWrapper>
      </QueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
);

// Signal the index.html watchdog that the app mounted, so it doesn't trigger a
// recovery reload. Runs after render is scheduled.
window.__maydayBooted__?.();

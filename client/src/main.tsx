import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext.js';
import { DeviceProvider } from './context/DeviceContext.js';
import { IntlProviderWrapper } from './i18n/IntlProviderWrapper.js';
import { App } from './App.js';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);

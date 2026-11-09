import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { EnvBanner } from './components/EnvBanner';
import { APP_ENV } from './lib/appEnv';
import './index.css';
import './i18n';

if (APP_ENV !== 'production') document.title = `[${APP_ENV === 'preprod' ? 'PREPROD' : 'DEV'}] ${document.title}`;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <EnvBanner />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

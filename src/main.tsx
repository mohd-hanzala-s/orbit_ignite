import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ThemeProvider, useTheme } from './lib/theme';
import { TooltipProvider } from './components/ui/misc';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, e: any) => n < 1 && (e?.status ?? 500) >= 500, refetchOnWindowFocus: false } },
});

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="bottom-right" richColors closeButton toastOptions={{ style: { borderRadius: 16, fontFamily: 'var(--font-sans)' } }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider>
              <App />
              <ThemedToaster />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);

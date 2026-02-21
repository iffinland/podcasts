import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeProviderWrapper from './styles/theme/theme-provider.tsx';
import './index.css';
import { i18nReady } from './i18n/i18n';
import App from './App.tsx';

void i18nReady.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProviderWrapper>
        <App />
      </ThemeProviderWrapper>
    </StrictMode>
  );
});

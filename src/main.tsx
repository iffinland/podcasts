import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ThemeProviderWrapper from './styles/theme/theme-provider.tsx';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProviderWrapper>
      <App />
    </ThemeProviderWrapper>
  </StrictMode>
);

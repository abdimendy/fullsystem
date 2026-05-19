import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { configureApi } from './api/configureApi';

async function bootstrap() {
  const rootEl = document.getElementById('root');
  rootEl.innerHTML =
    '<p style="margin:0;padding:2rem;text-align:center;font-family:system-ui,sans-serif;color:#334155">Loading YellowBook…</p>';

  await configureApi();

  createRoot(rootEl).render(
    <StrictMode>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </StrictMode>
  );
}

bootstrap();

import api from './axiosInstance';

/** Optional external API (Render). Used when not on Vercel or when explicitly configured. */
export const DEFAULT_PRODUCTION_API_ORIGIN = 'https://yellowbook-api.onrender.com';

function normalizeApiUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return null;
  if (trimmed === '/api') return '/api';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/** Vercel / Netlify: use relative /api (functions + static _data), same as localhost proxy. */
function isHostedWithRelativeApi() {
  if (typeof window === 'undefined') return false;
  return /(vercel|netlify)\.app$/i.test(window.location.hostname);
}

function isUsableExternalApiUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http')) return false;
  if (import.meta.env.DEV) return true;
  const lower = trimmed.toLowerCase();
  if (lower.includes('.loca.lt') || lower.includes('trycloudflare.com')) {
    console.warn('[YellowBook API] Ignoring dev tunnel URL in production:', trimmed);
    return false;
  }
  return true;
}

export function resolveApiBaseUrl() {
  // Dev: Vite proxy → http://localhost:5261 (see vite.config.js)
  if (import.meta.env.DEV) return '/api';

  const envTrimmed = import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim();

  // Vercel / Netlify: /api → serverless (demo data, or BACKEND_URL proxy) — same pattern as localhost
  if (import.meta.env.PROD && isHostedWithRelativeApi()) {
    if (!envTrimmed || envTrimmed === '/api') return '/api';
    const normalized = normalizeApiUrl(envTrimmed);
    if (isUsableExternalApiUrl(normalized)) return normalized;
    return '/api';
  }

  if (envTrimmed) {
    const normalized = normalizeApiUrl(envTrimmed);
    if (normalized === '/api' || isUsableExternalApiUrl(normalized)) return normalized;
  }

  const fromDefault = normalizeApiUrl(
    import.meta.env.VITE_DEFAULT_API_URL || DEFAULT_PRODUCTION_API_ORIGIN
  );
  if (isUsableExternalApiUrl(fromDefault)) return fromDefault;

  return `${DEFAULT_PRODUCTION_API_ORIGIN}/api`;
}

export async function configureApi() {
  let baseURL = resolveApiBaseUrl();

  if (!import.meta.env.DEV) {
    try {
      const res = await fetch(`/config.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const fromConfig = normalizeApiUrl(data.apiUrl);
        if (fromConfig === '/api' && (isHostedWithRelativeApi() || import.meta.env.VITE_USE_RELATIVE_API === 'true')) {
          baseURL = '/api';
        } else if (isUsableExternalApiUrl(fromConfig)) {
          baseURL = fromConfig;
        } else if (data.apiUrl && fromConfig !== '/api') {
          console.warn('[YellowBook API] config.json apiUrl ignored:', data.apiUrl);
        }
      }
    } catch (err) {
      console.warn('[YellowBook API] Could not load config.json;', err?.message || err);
    }
  }

  api.defaults.baseURL = baseURL;
  console.info('[YellowBook API] baseURL =', baseURL);

  const tryHealth = async (label, base) => {
    const prev = api.defaults.baseURL;
    api.defaults.baseURL = base;
    try {
      const { data } = await api.get('/health');
      if (data?.status === 'healthy' || data?.status === 'degraded') {
        console.info('[YellowBook API] health OK', label, data?.status, data?.provider || '');
        const t = localStorage.getItem('yellowbook_token');
        if (t?.startsWith('offline.') || t?.startsWith('dev.') || t?.startsWith('demo.')) {
          localStorage.removeItem('yellowbook_token');
          localStorage.removeItem('yellowbook_user');
          localStorage.removeItem('yellowbook_expires');
          window.dispatchEvent(new Event('yellowbook-session-cleared'));
        }
        return true;
      }
    } catch {
      /* try next */
    }
    api.defaults.baseURL = prev;
    return false;
  };

  let live = await tryHealth('primary', baseURL);

  if (!live && isHostedWithRelativeApi() && baseURL === '/api') {
    const renderBase = normalizeApiUrl(DEFAULT_PRODUCTION_API_ORIGIN);
    if (renderBase && renderBase !== '/api') {
      live = await tryHealth('render', renderBase);
      if (live) {
        baseURL = renderBase;
        api.defaults.baseURL = baseURL;
      }
    }
  }

  if (!live && (isHostedWithRelativeApi() || import.meta.env.DEV) && (baseURL === '/api' || import.meta.env.DEV)) {
    api.defaults.useBundledPublicApi = true;
    const hint = import.meta.env.DEV
      ? 'Run .\\START.ps1 (or .\\scripts\\start-api-neon.ps1) for login + Neon database.'
      : isHostedWithRelativeApi()
        ? 'Set BACKEND_URL on host (Netlify env / Vercel) to https://yellowbook-api.onrender.com for live DB.'
        : 'For Neon DB, run .\\scripts\\sync-vercel-live.ps1';
    console.info(`[YellowBook API] Using bundled directory data. ${hint}`);
  } else if (!live) {
    console.warn('[YellowBook API] health check failed — per-request demo fallback may apply.');
  }

  return baseURL;
}

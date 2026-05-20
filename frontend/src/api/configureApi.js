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

const BUILD_SEEN_KEY = 'yellowbook_seen_build';
const BUILD_RELOAD_KEY = 'yellowbook_reload_done';

/** After deploy, reload once so users never keep a stale cached index.html / JS bundle. */
async function ensureFreshBuild() {
  if (import.meta.env.DEV || typeof window === 'undefined') return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (!build) return;

    const seen = sessionStorage.getItem(BUILD_SEEN_KEY);
    if (seen && seen !== build && !sessionStorage.getItem(BUILD_RELOAD_KEY)) {
      sessionStorage.setItem(BUILD_RELOAD_KEY, '1');
      sessionStorage.setItem(BUILD_SEEN_KEY, build);
      window.location.reload();
      await new Promise(() => {});
    }
    sessionStorage.removeItem(BUILD_RELOAD_KEY);
    sessionStorage.setItem(BUILD_SEEN_KEY, build);
  } catch {
    /* non-fatal */
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  await ensureFreshBuild();

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

  const isDemoHealth = (data) => {
    const p = String(data?.provider || '').toLowerCase();
    if (p.includes('neon') || p.includes('npgsql') || p.includes('render-live')) return false;
    return (
      p.includes('demo') ||
      p.includes('static') ||
      p.includes('netlify-demo') ||
      p.includes('netlify-proxy') ||
      p.includes('netlify-static') ||
      p.includes('vercel-static')
    );
  };

  const tryHealth = async (label, base) => {
    const prev = api.defaults.baseURL;
    api.defaults.baseURL = base;
    try {
      const timeout = import.meta.env.DEV ? 10000 : 45000;
      const { data } = await api.get('/health', { timeout });
      if (data?.status === 'healthy' || data?.status === 'degraded') {
        if (isHostedWithRelativeApi() && isDemoHealth(data)) {
          console.info('[YellowBook API] free static API at', label, data?.provider || '');
          api.defaults.useBundledPublicApi = true;
          return true;
        }
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

  let live = false;
  if (import.meta.env.DEV && baseURL === '/api') {
    console.info('[YellowBook API] Waiting for local API (http://localhost:5261)…');
    for (let attempt = 0; attempt < 20; attempt++) {
      live = await tryHealth(attempt === 0 ? 'primary' : `local-retry-${attempt}`, baseURL);
      if (live) break;
      await sleep(800);
    }
  } else if (import.meta.env.PROD && isHostedWithRelativeApi() && baseURL === '/api') {
    for (let attempt = 0; attempt < 5; attempt++) {
      live = await tryHealth(attempt === 0 ? 'primary' : `hosted-retry-${attempt}`, baseURL);
      if (live) break;
      await sleep(1200);
    }
  } else {
    live = await tryHealth('primary', baseURL);
  }

  if (live && isHostedWithRelativeApi() && baseURL === '/api') {
    try {
      await api.get('/health', { timeout: 15000 });
    } catch {
      /* warm serverless */
    }
  }

  if (
    !live &&
    !import.meta.env.DEV &&
    !isHostedWithRelativeApi() &&
    isUsableExternalApiUrl(normalizeApiUrl(DEFAULT_PRODUCTION_API_ORIGIN))
  ) {
    const renderBase = normalizeApiUrl(DEFAULT_PRODUCTION_API_ORIGIN);
    if (renderBase && renderBase !== baseURL) {
      live = await tryHealth('render-live', renderBase);
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
        ? 'Set DATABASE_URL on Netlify (Site settings → Environment) from your .env Neon URL.'
        : 'For Neon DB, run .\\scripts\\sync-vercel-live.ps1';
    console.info(`[YellowBook API] Using bundled directory data. ${hint}`);
  } else if (!live) {
    console.warn('[YellowBook API] health check failed — per-request demo fallback may apply.');
  }

  return baseURL;
}

export function isUsingBundledPublicApi() {
  return Boolean(api.defaults.useBundledPublicApi);
}

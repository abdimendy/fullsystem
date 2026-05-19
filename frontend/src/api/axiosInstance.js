import axios from 'axios';
import { resolveApiBaseUrl } from './configureApi';
import { ensureArray } from '../utils/apiHelpers';
import { getDemoResponse, shouldUseDemoFallback } from '../utils/demoFallback';

const PUBLIC_GET_PREFIXES = [
  '/categories',
  '/businesses',
  '/dashboard',
  '/reviews',
  '/health',
];

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

function isHtmlPayload(response) {
  const data = response.data;
  // 204 No Content (e.g. DELETE) — empty body is valid, not HTML
  if (data == null || data === '') return false;
  if (typeof data !== 'string') return false;
  const trimmed = data.trimStart();
  return trimmed.startsWith('<') || trimmed.includes('<!DOCTYPE');
}

function isOfflineToken() {
  const t = localStorage.getItem('yellowbook_token') || '';
  return t.startsWith('offline.') || t.startsWith('dev.');
}

function mutationBlockedMessage() {
  if (isOfflineToken()) {
    return 'You are in offline demo mode. Start the API (.\\scripts\\start-api-neon.ps1), then log in again with admin / Admin@123.';
  }
  return 'API unavailable. Start the API: .\\scripts\\start-api-neon.ps1 — then use http://localhost:5175';
}

function fullRequestUrl(config) {
  const base = config.baseURL || api.defaults.baseURL || '';
  const path = config.url || '';
  if (base.startsWith('http')) return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  if (typeof window !== 'undefined') return `${window.location.origin}${base}${path}`;
  return `${base}${path}`;
}

function bundledAdapter(config) {
  const demo = getDemoResponse(config);
  if (demo === null) {
    return Promise.reject({
      config,
      friendlyMessage: 'This action needs the live API. Run .\\scripts\\start-api-neon.ps1 locally.',
    });
  }
  return Promise.resolve({
    data: demo,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config,
    demoMode: true,
  });
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && method !== 'head' && isOfflineToken()) {
    return Promise.reject({
      friendlyMessage: mutationBlockedMessage(),
      config,
    });
  }

  if (api.defaults.useBundledPublicApi && (method === 'get' || method === 'head')) {
    const demo = getDemoResponse(config);
    if (demo !== null) {
      config.adapter = bundledAdapter;
    }
  }

  const token = localStorage.getItem('yellowbook_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isHtmlPayload(response)) {
      const method = (response.config?.method || 'get').toLowerCase();
      const fakeErr = { config: response.config, response };
      if (method === 'get' && shouldUseDemoFallback(fakeErr)) {
        const demo = getDemoResponse(response.config);
        if (demo !== null) {
          return Promise.resolve({
            data: demo,
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/json' },
            config: response.config,
            demoMode: true,
          });
        }
      }
      return Promise.reject({
        friendlyMessage:
          method === 'get'
            ? 'API unavailable. Run .\\scripts\\start-api-neon.ps1 then refresh.'
            : mutationBlockedMessage(),
        response,
      });
    }

    const url = response.config?.url?.split('?')[0] || '';
    const method = (response.config?.method || 'get').toLowerCase();
    if (
      method === 'get' &&
      PUBLIC_GET_PREFIXES.some((p) => url === p || url.startsWith(`${p}/`)) &&
      response.data != null &&
      typeof response.data === 'object' &&
      !Array.isArray(response.data) &&
      !('items' in response.data) &&
      !('totalCount' in response.data) &&
      'message' in response.data
    ) {
      return Promise.reject({
        friendlyMessage: response.data.message || 'API unavailable',
        response,
      });
    }

    if (
      method === 'get' &&
      (url === '/categories' ||
        url === '/businesses' ||
        url.startsWith('/businesses/featured') ||
        url.startsWith('/payments')) &&
      response.data != null &&
      typeof response.data === 'object' &&
      !Array.isArray(response.data)
    ) {
      response.data = ensureArray(response.data);
    }

    return response;
  },
  (error) => {
    if (error.friendlyMessage && !error.response) {
      return Promise.reject(error);
    }

    const requestPath = (error.config?.url || '').split('?')[0];
    const skipDemoForLiveBusinessDetail =
      /^\/businesses\/\d+$/.test(requestPath) && !api.defaults.useBundledPublicApi;

    if (!skipDemoForLiveBusinessDetail && shouldUseDemoFallback(error)) {
      const demo = getDemoResponse(error.config);
      if (demo !== null) {
        return Promise.resolve({
          data: demo,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          config: error.config,
          demoMode: true,
        });
      }
    }

    const status = error.response?.status;
    const handledByDemo =
      !skipDemoForLiveBusinessDetail &&
      shouldUseDemoFallback(error) &&
      getDemoResponse(error.config) !== null;
    if ((status === 404 || status === 502 || status === 503) && !handledByDemo) {
      console.error('[YellowBook API]', status, fullRequestUrl(error.config || {}), error.response?.data);
    }

    if (error.response?.status === 401) {
      const isLogin = error.config?.url?.includes('/auth/login');
      const requestPath = error.config?.url?.split('?')[0] || '';
      const isPublicRead =
        (error.config?.method || 'get').toLowerCase() === 'get' &&
        PUBLIC_GET_PREFIXES.some((p) => requestPath === p || requestPath.startsWith(`${p}/`));

      if (!isLogin && !isPublicRead && !isOfflineToken()) {
        localStorage.removeItem('yellowbook_token');
        localStorage.removeItem('yellowbook_user');
        localStorage.removeItem('yellowbook_expires');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
        }
      }
    }

    const message =
      error.friendlyMessage ||
      error.response?.data?.message ||
      error.response?.data?.title ||
      (error.response?.data?.errors
        ? Object.values(error.response.data.errors).flat().join(', ')
        : null) ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject({ ...error, friendlyMessage: message });
  }
);

export default api;
